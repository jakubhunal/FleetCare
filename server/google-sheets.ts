import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { SheetTab } from "./sheets-store";

export type Cell = string | number | boolean;
const API = "https://sheets.googleapis.com/v4/spreadsheets";
const quote = (tab: string) => `'${tab.replace(/'/g, "''")}'`;
const columnLabel = (n: number) => {
  let label = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26))
    label = String.fromCharCode(65 + ((x - 1) % 26)) + label;
  return label;
};
const failure = (message: string, status: number) =>
  Object.assign(new Error(message), { status: status === 429 ? 429 : 502 });

export class GoogleSheets {
  private token?: { value: string; expiresAt: number };
  private credentials?: { client_email: string; private_key: string };
  constructor(
    private sheetId: string,
    private auth: { credentialsPath?: string; accessToken?: string },
  ) {}

  private async accessToken() {
    // Local testing only: a short-lived OAuth token of a person with access to the sheet.
    if (this.auth.accessToken) return this.auth.accessToken;
    if (this.token && this.token.expiresAt > Date.now() + 60_000)
      return this.token.value;
    this.credentials ??= JSON.parse(
      await readFile(this.auth.credentialsPath!, "utf8"),
    );
    const now = Math.floor(Date.now() / 1000);
    const enc = (v: unknown) =>
      Buffer.from(JSON.stringify(v)).toString("base64url");
    const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
      iss: this.credentials!.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${signer.sign(this.credentials!.private_key, "base64url")}`,
      }),
    });
    if (!response.ok)
      throw failure(`Google OAuth ${response.status}`, response.status);
    const body = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.token = {
      value: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };
    return this.token.value;
  }

  private async call(path: string, init: RequestInit = {}) {
    let response!: Response;
    // Sheets allows 60 reads and 60 writes per minute; wait out short bursts instead of failing the user (FE timeout is 20 s).
    for (const pause of [4000, 10000, 0]) {
      response = await fetch(`${API}/${this.sheetId}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${await this.accessToken()}`,
          "content-type": "application/json",
          ...init.headers,
        },
      });
      if (response.status !== 429 || !pause) break;
      console.warn(`Sheets API 429, další pokus za ${pause / 1000} s.`);
      await new Promise((r) => setTimeout(r, pause));
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        `Sheets API ${response.status} ${path.slice(0, 80)}: ${detail.slice(0, 300)}`,
      );
      throw failure(
        `Google Sheets vrátil chybu ${response.status}.`,
        response.status,
      );
    }
    return response.json();
  }

  async readTabs(titles: string[]): Promise<Map<string, SheetTab>> {
    const ranges = titles
      .map((t) => `ranges=${encodeURIComponent(`${quote(t)}!A:ZZ`)}`)
      .join("&");
    const body = (await this.call(
      `/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE`,
    )) as {
      valueRanges: { values?: Cell[][] }[];
    };
    const tabs = new Map<string, SheetTab>();
    body.valueRanges.forEach((range, i) => {
      const values = range.values || [];
      tabs.set(titles[i], {
        title: titles[i],
        headers: (values[0] || []).map((x) => String(x).trim()),
        rows: values
          .slice(1)
          .flatMap((row, n) =>
            row.some((x) => x !== "" && x != null)
              ? [{ rowNumber: n + 2, values: row }]
              : [],
          ),
      });
    });
    return tabs;
  }

  async updateRows(rows: { tab: string; rowNumber: number; values: Cell[] }[]) {
    await this.call("/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: rows.map((r) => ({
          range: `${quote(r.tab)}!A${r.rowNumber}:${columnLabel(Math.max(1, r.values.length))}${r.rowNumber}`,
          majorDimension: "ROWS",
          values: [r.values],
        })),
      }),
    });
  }

  async appendRows(tab: string, rows: Cell[][]) {
    await this.call(
      `/values/${encodeURIComponent(`${quote(tab)}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        body: JSON.stringify({ majorDimension: "ROWS", values: rows }),
      },
    );
  }

  /** Creates missing tabs and appends missing header columns. Existing columns never move (Make maps them). */
  async ensureSchema(required: { tab: string; headers: string[] }[]) {
    const meta = (await this.call(
      "?fields=sheets.properties(title,sheetId,gridProperties)",
    )) as {
      sheets: {
        properties: {
          title: string;
          sheetId: number;
          gridProperties: { columnCount: number };
        };
      }[];
    };
    const existing = new Map(
      meta.sheets.map((s) => [s.properties.title, s.properties]),
    );
    const requests: unknown[] = [];
    for (const r of required)
      if (!existing.has(r.tab))
        requests.push({
          addSheet: {
            properties: {
              title: r.tab,
              gridProperties: {
                rowCount: 1000,
                columnCount: Math.max(26, r.headers.length),
              },
            },
          },
        });
    if (requests.length)
      await this.call(":batchUpdate", {
        method: "POST",
        body: JSON.stringify({ requests }),
      });
    const tabs = await this.readTabs(required.map((r) => r.tab));
    const widen: unknown[] = [];
    const headerWrites: { tab: string; rowNumber: number; values: Cell[] }[] =
      [];
    const added: string[] = [];
    for (const r of required) {
      const headers = tabs.get(r.tab)?.headers || [];
      const missing = r.headers.filter((h) => !headers.includes(h));
      if (!missing.length) continue;
      const next = [...headers, ...missing];
      const props = existing.get(r.tab);
      if (props && props.gridProperties.columnCount < next.length)
        widen.push({
          appendDimension: {
            sheetId: props.sheetId,
            dimension: "COLUMNS",
            length: next.length - props.gridProperties.columnCount,
          },
        });
      headerWrites.push({ tab: r.tab, rowNumber: 1, values: next });
      added.push(`${r.tab}: ${missing.join(", ")}`);
    }
    if (widen.length)
      await this.call(":batchUpdate", {
        method: "POST",
        body: JSON.stringify({ requests: widen }),
      });
    if (headerWrites.length) await this.updateRows(headerWrites);
    return added;
  }
}
