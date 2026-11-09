import type { Workspace } from "./models";
import { deadlines } from "./rules";

/**
 * A5 for the daily Make run (M2): every deadline the Termíny page shows –
 * manual deadlines, STK of vehicles, insurance, driver licences and
 * qualifications, service plans – that is due within 30 days or overdue.
 * The item shape is the one M2 already reads from the Sheets gateway.
 */
export type A5Item = {
  item_key: string;
  vehicle_id: string;
  vehicle_spz: string;
  vin: string;
  brand_model: string;
  deadline_type: string;
  valid_until: string;
  manager_email: string;
  /** Who the deadline belongs to, for the e-mail text. */
  label: string;
  /** Warning level M2 computes for the same date: 30d, 14d, 7d or overdue. */
  level: string;
};

// M2 has the levels fixed (30/14/7 days); the same values keep the claim in
// step with its Data Store keys.
const levels = [7, 14, 30];
export function a5Level(daysLeft: number) {
  if (daysLeft < 0) return "overdue";
  const hit = levels.find((l) => daysLeft <= l);
  return hit === undefined ? null : `${hit}d`;
}
const pragueDay = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(d);
const dayNumber = (iso: string) =>
  Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) /
  86_400_000;
/** Same cleaning as the Sheets gateway, so existing Data Store keys still match. */
const clean = (v: string) =>
  v.replace(/["\\]/g, "'").replace(/[\x00-\x1F]/g, " ");

export function a5Items(s: Workspace, now = new Date()): A5Item[] {
  const today = dayNumber(pragueDay(now));
  const items: A5Item[] = [];
  for (const d of deadlines(s, now)) {
    if (!d.date || d.state === "Splněno" || d.kind === "A6") continue;
    const level = a5Level(dayNumber(d.date) - today);
    if (!level) continue;
    const vehicle = s.vehicles.find((v) => v.id === d.vehicleId);
    const driver = s.drivers.find((x) => x.id === d.driverId);
    const type = d.derived
      ? d.kind === "STK" || d.kind === "Pojištění"
        ? d.kind
        : d.kind === "Oprávnění"
          ? `řidičské oprávnění ${d.detail}`.trim()
          : d.kind === "Kvalifikace"
            ? `kvalifikace ${d.detail}`.trim()
            : d.kind === "Servis"
              ? `servis: ${d.detail}`
              : d.title
      : d.title;
    items.push({
      // Manual deadlines keep the key the Sheets gateway used.
      item_key: d.derived
        ? `A5:${d.vehicleId || d.driverId || "-"}:${clean(d.id)}:${d.date}`
        : `A5:${d.vehicleId || ""}:${clean(d.title)}:${d.date}`,
      vehicle_id: d.vehicleId || "",
      vehicle_spz: clean(vehicle?.spz || driver?.name || ""),
      vin: clean(vehicle?.vin || ""),
      brand_model: clean(vehicle?.model || ""),
      deadline_type: clean(type),
      valid_until: d.date,
      manager_email: s.settings.managerEmail,
      label: clean(
        vehicle
          ? `vozidlo ${vehicle.spz} (${vehicle.model}${vehicle.vin ? `, VIN: ${vehicle.vin}` : ""})`
          : driver
            ? `řidič ${driver.name}`
            : d.title,
      ),
      level,
    });
  }
  return items;
}
