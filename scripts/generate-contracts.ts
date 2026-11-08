import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { collections, settingsSchema } from "../src/domain/models";
import { commandSchema } from "../src/data/command-schema";
import { integrationEventSchema } from "../src/integrations/contracts";
const schema = (v: z.ZodType) => {
  const data = z.toJSONSchema(v);
  delete data.$schema;
  return data;
};
const ref = (name: string) => ({ $ref: "#/components/schemas/" + name });
const json = (v: object) => ({ "application/json": { schema: v } });
const error = {
  description:
    "Chyba: code, message, fieldErrors, correlationId; 409 konflikt verze, 429 Retry-After.",
  content: json(ref("Error")),
};
const response = { description: "OK", content: json(ref("Workspace")) };
const secured = [{ sessionCookie: [] }];
const document = {
  openapi: "3.1.0",
  info: {
    title: "FleetCare Integration Gateway",
    version: "1.0.0",
    description:
      "Smlouva dodaného HTTP adaptéru. Backend, ověřená identita a Make jsou následná implementace. X-Actor-Context je URL-encoded JSON kontextu, nikdy důkaz oprávnění.",
  },
  servers: [{ url: "https://api.example.invalid/v1" }],
  security: secured,
  paths: {
    "/workspace": {
      get: {
        summary:
          "Konzistentní projekce pracovního prostoru pro povolený kontext. Metadata bez binárních souborů; úplný výběr pro výpočty a exporty.",
        responses: {
          "200": response,
          "401": error,
          "403": error,
          "429": error,
          "503": error,
        },
      },
    },
    "/actor-options": {
      get: {
        summary:
          "Dostupné volby lokálního / dočasného kontextu řidiče. V ostrém provozu výhradně podle ověřené identity.",
        responses: {
          "200": {
            description: "Volby kontextu",
            content: json({
              type: "array",
              items: {
                type: "object",
                required: ["id", "name"],
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                },
              },
            }),
          },
          "403": error,
        },
      },
    },
    "/search": {
      post: {
        summary:
          "Serverové hledání napříč celou povolenou evidencí, normalizace diakritiky, velikosti písmen a mezer SPZ.",
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["query"],
            properties: { query: { type: "string" } },
          }),
        },
        responses: {
          "200": {
            description: "Seskupitelné výsledky",
            content: json({ type: "array", items: ref("SearchResult") }),
          },
          "429": error,
        },
      },
    },
    "/commands": {
      post: {
        summary:
          "Jedna atomická doménová operace s verzí a outboxem. Neukládat ručně novou zakázku.",
        parameters: [
          {
            in: "header",
            name: "Idempotency-Key",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: { required: true, content: json(ref("Command")) },
        responses: {
          "204": {
            description:
              "Transakce byla dokončena. Následuje invalidace projekce.",
          },
          "403": error,
          "409": error,
          "422": error,
          "429": error,
        },
      },
    },
    "/uploads": {
      post: {
        summary:
          "Vytvoření nebo obnovení idempotentní upload session. STK intake nesmí vytvořit prázdné vozidlo.",
        requestBody: { required: true, content: json(ref("UploadRequest")) },
        responses: {
          "200": {
            description: "Upload session",
            content: json({
              type: "object",
              required: ["uploadId"],
              properties: { uploadId: { type: "string" } },
            }),
          },
          "413": error,
          "422": error,
        },
      },
    },
    "/uploads/{uploadId}/content": {
      put: {
        summary:
          "Přenos souboru do soukromého úložiště. MIME a podpis souboru ověřuje backend.",
        parameters: [
          {
            in: "path",
            name: "uploadId",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/pdf": { schema: { type: "string", format: "binary" } },
            "image/jpeg": { schema: { type: "string", format: "binary" } },
            "image/png": { schema: { type: "string", format: "binary" } },
          },
        },
        responses: {
          "204": { description: "Binární obsah uložen" },
          "413": error,
          "415": error,
        },
      },
    },
    "/uploads/{uploadId}/complete": {
      post: {
        summary:
          "Finalizace dokumentu a extrakční úlohy. Pracovní smlouva nevyžaduje extrakci.",
        parameters: [
          {
            in: "path",
            name: "uploadId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "202": {
            description: "Úloha přijata, nikoli dokončena",
            content: json(ref("Job")),
          },
          "200": {
            description: "Finalizováno bez čekání na OCR",
            content: json(ref("Job")),
          },
          "409": error,
        },
      },
    },
    "/receipts/read": {
      post: {
        summary:
          "Přečte údaje z tankovací účtenky (PDF s textovou vrstvou) bez uložení, aby šel předvyplnit formulář tankování. Fotografie vrací failed s důvodem.",
        requestBody: {
          required: true,
          content: {
            "application/pdf": { schema: { type: "string", format: "binary" } },
            "image/jpeg": { schema: { type: "string", format: "binary" } },
            "image/png": { schema: { type: "string", format: "binary" } },
          },
        },
        responses: {
          "200": {
            description: "Výsledek čtení",
            content: json(ref("ReceiptRead")),
          },
          "413": error,
          "415": error,
          "422": error,
        },
      },
    },
    "/jobs/{jobId}": {
      get: {
        summary:
          "Stav asynchronní úlohy; FE používá omezený backoff a pozastaví polling na pozadí.",
        parameters: [
          {
            in: "path",
            name: "jobId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Stav úlohy", content: json(ref("Job")) },
          "403": error,
          "404": error,
        },
      },
    },
    "/documents/{documentId}/content": {
      get: {
        summary:
          "Nové oprávněné čtení originálu. Gateway může obnovit expirovaný podpis; storageKey zůstává stabilní.",
        parameters: [
          {
            in: "path",
            name: "documentId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Binární PDF/JPEG/PNG",
            content: {
              "application/pdf": {
                schema: { type: "string", format: "binary" },
              },
              "image/jpeg": { schema: { type: "string", format: "binary" } },
              "image/png": { schema: { type: "string", format: "binary" } },
            },
          },
          "403": error,
          "404": error,
        },
      },
    },
    "/integration-events": {
      post: {
        summary:
          "Budoucí serverový callback Make → gateway. Tento endpoint FE nikdy nevolá.",
        security: [{ integrationSignature: [] }],
        requestBody: { required: true, content: json(ref("IntegrationEvent")) },
        responses: {
          "202": { description: "Událost deduplikována / přijata" },
          "409": error,
          "422": error,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "fleetcare_session",
      },
      integrationSignature: {
        type: "apiKey",
        in: "header",
        name: "X-Integration-Signature",
      },
    },
    schemas: {
      ...Object.fromEntries(
        Object.entries(collections).map(([name, v]) => [name, schema(v)]),
      ),
      Settings: schema(settingsSchema),
      Workspace: {
        type: "object",
        required: [...Object.keys(collections), "settings"],
        properties: {
          ...Object.fromEntries(
            Object.keys(collections).map((key) => [
              key,
              { type: "array", items: ref(key) },
            ]),
          ),
          settings: ref("Settings"),
        },
      },
      Command: schema(commandSchema),
      IntegrationEvent: schema(integrationEventSchema),
      SearchResult: {
        type: "object",
        required: ["id", "type", "title", "subtitle", "path"],
        properties: Object.fromEntries(
          ["id", "type", "title", "subtitle", "path"].map((x) => [
            x,
            { type: "string" },
          ]),
        ),
      },
      UploadRequest: {
        type: "object",
        required: ["ownerType", "ownerId", "type", "file"],
        properties: {
          ownerType: {
            type: "string",
            enum: [
              "vehicle",
              "driver",
              "order",
              "fuel",
              "fault",
              "statement",
              "expense",
              "intake",
            ],
          },
          ownerId: { type: "string" },
          vehicleId: { type: ["string", "null"] },
          type: { type: "string" },
          validUntil: { type: ["string", "null"], format: "date" },
          dueAt: { type: ["string", "null"], format: "date" },
          file: {
            type: "object",
            required: ["name", "mime", "size"],
            properties: {
              name: { type: "string" },
              mime: {
                type: "string",
                enum: ["application/pdf", "image/jpeg", "image/png"],
              },
              size: { type: "integer", minimum: 1, maximum: 20971520 },
            },
          },
        },
      },
      ReceiptRead: {
        type: "object",
        required: ["state", "fields", "missingFields", "error"],
        properties: {
          state: {
            enum: ["completed", "incomplete", "failed", "not_configured"],
          },
          fields: {
            type: "object",
            description:
              "Údaje přečtené z účtenky; chybějící nebo nečitelné hodnoty se vynechají.",
            properties: {
              spz: { type: "string" },
              vin: { type: "string" },
              driverName: { type: "string" },
              date: { type: "string", format: "date" },
              time: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
              amountMinor: { type: "integer" },
              currency: { type: "string" },
              vat: { enum: ["Včetně DPH", "Bez DPH"] },
              litres: { type: "number" },
              fuel: { type: "string" },
              km: { type: "number" },
              station: { type: "string" },
              receiptNo: { type: "string" },
              cardNumber: { type: "string" },
            },
          },
          missingFields: { type: "array", items: { type: "string" } },
          error: { type: "string" },
        },
      },
      Job: {
        type: "object",
        required: ["jobId", "state"],
        properties: {
          jobId: { type: "string" },
          state: {
            enum: [
              "not_configured",
              "queued",
              "processing",
              "completed",
              "incomplete",
              "failed",
            ],
          },
          missingFields: { type: "array", items: { type: "string" } },
          error: { type: "string" },
          fields: {
            type: "object",
            description:
              "Údaje přečtené z nahrané STK (jen typ STK v gateway nad Sheets).",
            properties: {
              spz: { type: "string" },
              vin: { type: "string" },
              model: { type: "string" },
              category: {
                enum: ["Kamion", "Nákladní vozidlo", "Dodávka", "Osobní auto"],
              },
              stkUntil: { type: "string", format: "date" },
              inspectionDate: { type: "string", format: "date" },
              odometerKm: { type: "number" },
              result: { type: "string" },
              protocolNo: { type: "string" },
            },
          },
        },
      },
      Error: {
        type: "object",
        required: ["message"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          fieldErrors: { type: "object" },
          correlationId: { type: "string" },
        },
      },
    },
  },
};
await writeFile(
  new URL("../docs/openapi.json", import.meta.url),
  JSON.stringify(document, null, 2) + "\n",
);
await writeFile(
  new URL("../docs/events.schema.json", import.meta.url),
  JSON.stringify(z.toJSONSchema(integrationEventSchema), null, 2) + "\n",
);
console.log("OpenAPI and event JSON Schema generated from runtime schemas.");
