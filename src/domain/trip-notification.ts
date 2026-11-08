import type { Actor, Trip } from "./models";
export function tripNotificationReason(t: Trip): string | null {
  if (!t.endAt || t.state === "Probíhá")
    return "Prosíme o ukončení jízdy a doplnění skutečného konce a koncového tachometru.";
  if (t.endKm === null)
    return "Prosíme o doplnění koncového tachometru ukončené jízdy.";
  if (t.startKm >= t.endKm)
    return "Prosíme o kontrolu nesrovnalosti tachometru: počáteční hodnota musí být menší než koncová.";
  return null;
}
export function canNotifyTrip(actor: Actor, t: Trip) {
  return actor.role !== "Řidič" && tripNotificationReason(t) !== null;
}
