import { ccsStatus } from "../lib/status";
import { DomainError } from "./rules";
import { dateKey } from "../lib/format";
import { collections, meta, type Workspace } from "./models";
import type { CcsExtraction } from "./ccs-extract";
type Fuel = Workspace["fuels"][number];
/** CCS transactions linked to a fuel record that still disagree with it. */
export function fuelDifferences(s: Workspace, f: Fuel) {
  return s.transactions.filter(
    (t) =>
      t.fuelId === f.id &&
      t.state !== "Vyřešeno" &&
      (t.currency !== f.currency ||
        t.amountMinor !== f.amountMinor ||
        t.litres !== f.litres ||
        Date.parse(t.at) !== Date.parse(f.at) ||
        (t.cardId && t.cardId !== f.cardId) ||
        (t.vehicleId && t.vehicleId !== f.vehicleId)),
  );
}
/** One current CCS state for list and detail: the saved state unless an open difference exists. */
export function fuelState(s: Workspace, f: Fuel): Fuel["state"] {
  if (fuelDifferences(s, f).length) return "Rozdíl";
  // A saved difference alone is not evidence of a mismatching linked transaction.
  if (f.state === "Rozdíl")
    return s.transactions.some((t) => t.fuelId === f.id)
      ? "Spárováno"
      : "Čeká na výpis";
  return ccsStatus(f.state);
}
/** Transaction views obey the same evidence rule as their linked fuel record. */
export function transactionState(
  s: Workspace,
  t: Workspace["transactions"][number],
) {
  const f = s.fuels.find((f) => f.id === t.fuelId);
  if (f && fuelDifferences(s, f).some((x) => x.id === t.id)) return "Rozdíl";
  if (t.state === "Rozdíl") return f ? "Spárováno" : "Čeká na výpis";
  return ccsStatus(t.state);
}
/** Conservative matching: known card, exact time and litres; no fuzzy identity guess. */
export function reconcileCCS(s: Workspace, statementId: string) {
  for (const t of s.transactions) {
    if (t.statementId !== statementId || t.state === "Vyřešeno" || t.fuelId)
      continue;
    const setState = (state: typeof t.state) => {
      if (t.state !== state) {
        t.state = state;
        t.version++;
        t.updatedAt = new Date().toISOString();
      }
    };
    const card = s.cards.find((c) => c.id === t.cardId);
    const binding = card?.bindings.find(
      (b) => b.from <= dateKey(t.at) && (!b.to || b.to >= dateKey(t.at)),
    );
    if (!t.vehicleId && binding) t.vehicleId = binding.vehicleId;
    if (
      !card ||
      card.toleranceMinor === null ||
      !t.vehicleId ||
      t.litres === null
    ) {
      setState("Neúplný podklad");
      continue;
    }
    const candidates = s.fuels.filter(
      (f) =>
        f.cardId === t.cardId &&
        f.vehicleId === t.vehicleId &&
        f.currency === t.currency &&
        Date.parse(f.at) === Date.parse(t.at) &&
        f.litres !== null &&
        Math.abs(f.litres - t.litres!) < 0.001 &&
        !s.transactions.some(
          (other) => other.id !== t.id && other.fuelId === f.id,
        ),
    );
    if (candidates.length > 1) {
      setState("Neúplný podklad");
      continue;
    }
    if (!candidates.length) {
      setState("Chybí záznam řidiče");
      continue;
    }
    const f = candidates[0];
    if (f.amountMinor === null) {
      setState("Neúplný podklad");
      continue;
    }
    t.fuelId = f.id;
    t.state =
      Math.abs(t.amountMinor - f.amountMinor) <= card.toleranceMinor
        ? "Spárováno"
        : "Rozdíl";
    f.state = t.state;
    t.version++;
    f.version++;
    t.updatedAt = f.updatedAt = new Date().toISOString();
  }
}

/** Manual edits cannot invent a financial difference without linked evidence. */
export function validateFuelCCSState(s: Workspace, f: Fuel) {
  if (f.state === "Rozdíl" && !fuelDifferences(s, f).length)
    throw new DomainError(
      "Stav Rozdíl lze zvolit jen u spárovaného tankování s nevyřešeným rozdílem.",
      "state",
    );
}

const plain = (v = "") => v.replace(/[^0-9A-Z]/gi, "").toUpperCase();
/**
 * Stores the fuel rows read from a CCS statement as its transactions and pairs
 * them with fuel records. A card is recognised by its number in the card
 * block header, the vehicle by the plate there (otherwise by the card binding
 * during pairing). A transaction already imported from another statement
 * (same card, time, amount and litres) is not created twice, so a corrected
 * statement cannot double a cost. Rows that are not fuel (car wash, tolls)
 * are counted, never turned into fuel costs.
 */
export function importCcsStatement(
  s: Workspace,
  statementId: string,
  x: CcsExtraction,
) {
  const statement = s.statements.find((st) => st.id === statementId);
  if (!statement) throw new DomainError("Výpis není dostupný.");
  const cards = s.cards
    .map((c) => ({ card: c, key: plain(c.number) }))
    .filter((c) => c.key.length >= 6)
    .sort((a, b) => b.key.length - a.key.length);
  const now = new Date().toISOString();
  let created = 0,
    known = 0,
    other = 0;
  x.rows.forEach((row, i) => {
    if (!row.fuel) {
      other++;
      return;
    }
    const block = x.blocks[row.block];
    const header = plain(block?.header);
    const card = cards.find((c) => header.includes(c.key))?.card;
    const vehicle = block?.plate
      ? s.vehicles.find((v) => plain(v.spz) === plain(block.plate!))
      : undefined;
    const litres = Math.round(row.quantity * 1000) / 1000;
    if (
      s.transactions.some(
        (t) =>
          t.cardId === (card?.id ?? null) &&
          (card || t.vehicleId === (vehicle?.id ?? null)) &&
          Date.parse(t.at) === Date.parse(row.at) &&
          t.amountMinor === row.amountMinor &&
          t.litres === litres,
      )
    ) {
      known++;
      return;
    }
    s.transactions.push(
      collections.transactions.parse({
        ...meta(),
        source: "import",
        statementId,
        externalId: `${x.number || statement.name} · s. ${row.page} · ${i + 1}`,
        vehicleId: vehicle?.id ?? null,
        cardId: card?.id ?? null,
        at: row.at,
        amountMinor: row.amountMinor,
        currency: row.currency,
        litres,
        fuelId: null,
        state: "Čeká na výpis",
        resolvedMinor: null,
        resolution: "",
      }),
    );
    created++;
  });
  reconcileCCS(s, statementId);
  const mine = s.transactions.filter((t) => t.statementId === statementId);
  const count = (state: string) => mine.filter((t) => t.state === state).length;
  const pairing = [
    count("Spárováno") && `spárováno ${count("Spárováno")}`,
    count("Rozdíl") && `rozdíl ${count("Rozdíl")}`,
    count("Chybí záznam řidiče") &&
      `bez záznamu řidiče ${count("Chybí záznam řidiče")}`,
    count("Neúplný podklad") &&
      `neúplný podklad ${count("Neúplný podklad")} – karta není v evidenci nebo nemá toleranci`,
  ].filter(Boolean);
  const message = [
    `Transakce paliva: ${created}${pairing.length ? ` (${pairing.join(", ")})` : ""}.`,
    known && `Už dříve importované, nezaloženy znovu: ${known}.`,
    other && `Položky mimo palivo (např. mytí), které se nepárují: ${other}.`,
  ]
    .filter(Boolean)
    .join(" ");
  Object.assign(statement, {
    externalId: x.number,
    periodFrom:
      x.periodFrom ||
      (x.rows.length ? dateKey(x.rows.map((r) => r.at).sort()[0]) : null),
    periodTo:
      x.periodTo ||
      (x.rows.length
        ? dateKey(
            x.rows
              .map((r) => r.at)
              .sort()
              .at(-1)!,
          )
        : null),
    processing: x.state,
    complete: x.state === "completed",
    error: x.error || "",
    updatedAt: now,
    version: statement.version + 1,
  });
  return { created, known, other, message };
}
