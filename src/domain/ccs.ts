import { ccsStatus } from "../lib/status";
import { DomainError } from "./rules";
import { dateKey } from "../lib/format";
import type { Workspace } from "./models";
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
