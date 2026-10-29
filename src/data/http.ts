import { z } from "zod";
import { parseWorkspace, type Actor } from "../domain/models";
import type { CommandEnvelope, Repository, UploadInput } from "./contracts";
import { DomainError } from "../domain/rules";
import { scopedWorkspace } from "../domain/rules";
import { authorizeCommand } from "../domain/access";
import { commandSchema } from "./command-schema";
import { validateUpload } from "./uploads";
const searchSchema = z.array(
  z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    subtitle: z.string(),
    path: z.string().startsWith("/"),
  }),
);
const jobSchema = z.object({
  jobId: z.string(),
  state: z.enum([
    "queued",
    "processing",
    "completed",
    "incomplete",
    "failed",
    "not_configured",
  ]),
  missingFields: z.array(z.string()).optional(),
  error: z.string().optional(),
});
export class HttpRepository implements Repository {
  readonly mode = "http" as const;
  constructor(
    private base: string,
    private transport: typeof fetch = fetch.bind(globalThis),
  ) {
    if (!/^https?:\/\//.test(base) && !base.startsWith("/"))
      throw new DomainError(
        "Nastavte VITE_API_BASE_URL na URL gateway nebo relativní cestu začínající lomítkem.",
        undefined,
        503,
      );
    this.base = base.replace(/\/$/, "");
  }
  private async request(path: string, actor: Actor, init: RequestInit = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const abort = () => controller.abort();
    if (init.signal?.aborted) controller.abort();
    init.signal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await this.transport(this.base + path, {
        ...init,
        credentials: "include",
        signal: controller.signal,
        headers: {
          "X-Actor-Context": encodeURIComponent(JSON.stringify(actor)),
          ...(init.body && typeof init.body === "string"
            ? { "Content-Type": "application/json" }
            : {}),
          ...init.headers,
        },
      });
      if (!response.ok) {
        let message = `API vrátilo chybu ${response.status}.`;
        try {
          const body = z
            .object({ message: z.string().optional() })
            .parse(await response.json());
          message = body.message || message;
        } catch {
          /* Non-JSON gateway errors retain HTTP status. */
        }
        if (response.status === 409)
          message = "Konflikt verze: obnovte detail před opakováním změny.";
        if (response.status === 429)
          message = "Služba omezila počet požadavků. Zkuste operaci později.";
        throw new DomainError(message, undefined, response.status);
      }
      return response;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if (error instanceof Error && error.name === "AbortError")
        throw new DomainError(
          "Požadavek byl zrušen nebo vypršel časový limit.",
          undefined,
          408,
        );
      throw new DomainError(
        "API není dostupné. Lokální data nebyla použita.",
        undefined,
        503,
      );
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", abort);
    }
  }
  async read(actor: Actor, signal?: AbortSignal) {
    return scopedWorkspace(
      parseWorkspace(
        await (await this.request("/workspace", actor, { signal })).json(),
      ),
      actor,
    );
  }
  async identities(signal?: AbortSignal) {
    return z
      .array(z.object({ id: z.string(), name: z.string() }))
      .parse(
        await (
          await this.request(
            "/actor-options",
            { role: "Fleet manažer", driverId: null },
            { signal },
          )
        ).json(),
      );
  }
  async search(actor: Actor, query: string, signal?: AbortSignal) {
    return searchSchema.parse(
      await (
        await this.request("/search", actor, {
          method: "POST",
          body: JSON.stringify({ query }),
          signal,
        })
      ).json(),
    );
  }
  async execute(actor: Actor, input: CommandEnvelope, signal?: AbortSignal) {
    commandSchema.parse(input.command);
    authorizeCommand(actor, input.command);
    await this.request("/commands", actor, {
      method: "POST",
      body: JSON.stringify(input.command),
      headers: { "Idempotency-Key": input.idempotencyKey },
      signal,
    });
  }
  async upload(actor: Actor, input: UploadInput, signal?: AbortSignal) {
    validateUpload(input);
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const response = await this.request("/uploads", actor, {
        method: "POST",
        body: JSON.stringify({
          ...input,
          files: undefined,
          file: { name: file.name, mime: file.type, size: file.size },
        }),
        headers: { "Idempotency-Key": input.idempotencyKey + "-" + i },
        signal,
      });
      const session = z
        .object({ uploadId: z.string() })
        .parse(await response.json());
      await this.request(
        `/uploads/${encodeURIComponent(session.uploadId)}/content`,
        actor,
        {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
            "Idempotency-Key": input.idempotencyKey + "-" + i + "-content",
          },
          signal,
        },
      );
      const finish = await this.request(
        `/uploads/${encodeURIComponent(session.uploadId)}/complete`,
        actor,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": input.idempotencyKey + "-" + i + "-complete",
          },
          signal,
        },
      );
      jobSchema.parse(await finish.json());
    }
  }
  async file(actor: Actor, id: string, signal?: AbortSignal) {
    const r = await this.request(
      `/documents/${encodeURIComponent(id)}/content`,
      actor,
      { signal },
    );
    const blob = await r.blob();
    if (!["application/pdf", "image/jpeg", "image/png"].includes(blob.type))
      throw new DomainError("Server vrátil nepodporovaný obsah dokumentu.");
    return blob;
  }
  async job(actor: Actor, id: string, signal?: AbortSignal) {
    return jobSchema.parse(
      await (
        await this.request(`/jobs/${encodeURIComponent(id)}`, actor, { signal })
      ).json(),
    );
  }
}
