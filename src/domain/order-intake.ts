import { collections, meta, type Workspace } from "./models";
import { nextOrderNumber } from "./commands";
import type { OrderExtraction } from "./order-extract";

/**
 * Order received by e-mail (M2 → gateway): it always becomes an order with
 * the PDF attached. What the PDF states is taken over; when something needed
 * for assignment is missing, the order waits as "K doplnění" with the list.
 */
export function createOrderFromMail(
  s: Workspace,
  x: OrderExtraction,
  source: { fileName: string; receivedAt: string },
) {
  const f = x.fields;
  const stop = (
    type: "Nakládka" | "Vykládka",
    place?: string,
    from?: string,
    to?: string,
  ) => ({
    id: crypto.randomUUID(),
    type,
    place: place || "",
    from: from || null,
    to: to || null,
    contact: "",
    instructions: "",
  });
  const missing = x.missingFields;
  const when = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(source.receivedAt));
  const order = collections.orders.parse({
    ...meta(),
    source: "document",
    number: nextOrderNumber(s),
    customer: f.customer || "",
    reference: f.reference || "",
    contact: f.contact || "",
    stops: [
      stop("Nakládka", f.loadPlace, f.loadFrom, f.loadTo),
      stop("Vykládka", f.unloadPlace, f.unloadFrom, f.unloadTo),
    ],
    cargo: f.cargo || "",
    weightKg: f.weightKg ?? null,
    volumeM3: f.volumeM3 ?? null,
    pallets: f.pallets ?? null,
    dimensions: f.dimensions || "",
    equipment: (f.equipment || "")
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter(Boolean),
    priceMinor: f.priceMinor ?? null,
    currency: f.currency || "CZK",
    state: x.state === "completed" ? "K přiřazení" : "K doplnění",
    internalNote: [
      `Přijato e-mailem ${when}, příloha ${source.fileName}.`,
      x.error || (missing.length ? `Doplňte: ${missing.join(", ")}.` : ""),
    ]
      .filter(Boolean)
      .join(" "),
    externalId: f.number || "",
  });
  s.orders.push(order);
  return order;
}
