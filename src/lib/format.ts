export const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f\s]/g, "")
    .toLowerCase();
/** Calendar date in the application's timezone, not the UTC date substring. */
export const dateKey = (value: string) =>
  value.length === 10
    ? value
    : new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(
        new Date(value),
      );
export const number = (value: number | null | undefined, unit = "") =>
  value == null
    ? "Není doloženo"
    : `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value)}${unit ? " " + unit : ""}`;
export const money = (minor: number | null | undefined, currency = "CZK") =>
  minor == null
    ? "Není doloženo"
    : new Intl.NumberFormat("cs-CZ", { style: "currency", currency }).format(
        minor / 100,
      );
export function date(value: string | null | undefined, time = false) {
  if (!value) return "Není doloženo";
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(new Date(value.length === 10 ? value + "T12:00:00Z" : value));
}
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(
    new Date(),
  );
export const localTime = (value?: string | null) => {
  const d = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(" ", "T");
};
export function toUtc(value: string): string {
  if (!value) return "";
  const target = value.slice(0, 16);
  let t = Date.parse(target + "Z");
  for (let n = 0; n < 3; n++) {
    const got = Date.parse(localTime(new Date(t).toISOString()) + "Z");
    t += Date.parse(target + "Z") - got;
  }
  if (localTime(new Date(t).toISOString()) !== target)
    throw new Error("Tento čas v pásmu Europe/Prague neexistuje.");
  return new Date(t).toISOString();
}
export function decimal(input: string, nullable = true): number | null {
  if (!input.trim() && nullable) return null;
  const n = Number(input.replace(/\s/g, "").replace(",", "."));
  if (!input.trim() || !Number.isFinite(n))
    throw new Error("Zadejte platné číslo.");
  return n;
}
