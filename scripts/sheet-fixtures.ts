/**
 * Test fixtures written straight into the sheet, for data the app cannot
 * create itself: CCS statements/transactions (the CCS extraction is not
 * connected) and login accounts. Needs GOOGLE_ACCESS_TOKEN + GOOGLE_SHEET_ID.
 */
const env = () => {
  const { GOOGLE_ACCESS_TOKEN: token, GOOGLE_SHEET_ID: sheet } = process.env;
  if (!token || !sheet)
    throw new Error("Nastavte GOOGLE_ACCESS_TOKEN a GOOGLE_SHEET_ID.");
  return { token, sheet };
};
async function append(tab: string, row: Record<string, unknown>) {
  const { token, sheet } = env();
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheet}/values`;
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  const head = (await (
    await fetch(`${base}/${encodeURIComponent(`'${tab}'!1:1`)}`, { headers })
  ).json()) as { values?: string[][] };
  const columns = head.values?.[0];
  if (!columns?.length)
    throw new Error(`List ${tab} nemá hlavičku (běží už nová gateway?).`);
  const values = columns.map((c) => {
    const v = row[c];
    return v === undefined || v === null
      ? ""
      : typeof v === "object"
        ? JSON.stringify(v)
        : v;
  });
  const response = await fetch(
    `${base}/${encodeURIComponent(`'${tab}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ values: [values] }),
    },
  );
  if (!response.ok)
    throw new Error(
      `Zápis do ${tab} selhal: ${response.status} ${await response.text()}`,
    );
}
const stamp = () => new Date().toISOString();

/** A received CCS statement with one transaction, as the CCS import would store it. */
export async function addCcsTransaction(input: {
  name: string;
  cardId: string;
  at: string;
  litres: number;
  amountMinor: number;
}) {
  const statement = {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: stamp(),
    updatedAt: stamp(),
    source: "import",
    name: input.name,
    periodFrom: input.at.slice(0, 8) + "01",
    periodTo: null,
    receivedAt: stamp(),
    complete: true,
    processing: "completed",
    error: "",
    externalId: null,
  };
  const transaction = {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: stamp(),
    updatedAt: stamp(),
    source: "import",
    statementId: statement.id,
    externalId: `TEST-${String(Date.now()).slice(-8)}`,
    vehicleId: null,
    cardId: input.cardId,
    at: input.at,
    amountMinor: input.amountMinor,
    currency: "CZK",
    litres: input.litres,
    fuelId: null,
    state: "Čeká na výpis",
    resolvedMinor: null,
    resolution: "",
  };
  await append("ccs_statements", {
    statement_id: statement.id,
    name: statement.name,
    processing: statement.processing,
    fc_json: statement,
  });
  await append("ccs_transactions", {
    transaction_id: transaction.id,
    statement_id: statement.id,
    card_id: input.cardId,
    amount_czk: input.amountMinor / 100,
    litres: input.litres,
    state: transaction.state,
    fc_json: transaction,
  });
  return { statementId: statement.id, transactionId: transaction.id };
}

/** A login for the `accounts` sheet (passwords there are plain text by design of the school prototype). */
export async function addAccount(input: {
  email: string;
  password: string;
  role: "driver" | "fleet" | "management";
  driverId?: string;
}) {
  await append("accounts", {
    account_id: `test-${String(Date.now()).slice(-6)}`,
    email: input.email,
    password: input.password,
    role: input.role,
    driver_id: input.driverId || "",
    active: true,
  });
}
