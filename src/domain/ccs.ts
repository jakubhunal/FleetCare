import { dateKey } from "../lib/format";
import type { Workspace } from "./models";
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
      setState("Více kandidátů");
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
