import type { Document } from "../domain/models";

/** Generic attachments/delivery notes have no billing semantics; use optional validity. */
export function documentDateField(type: Document["type"]): {
  key: "validUntil" | "dueAt";
  label: string;
} {
  if (["Účtenka", "CCS výpis", "Servisní doklad", "Objednávka"].includes(type))
    return { key: "dueAt", label: "Splatnost" };
  return {
    key: "validUntil",
    label: type === "STK" ? "Platnost STK do" : "Platnost do",
  };
}

/** UI-only strict odometer check; missing values remain the required-field validator's job. */
export function odometerErrors(
  values: Record<string, unknown>,
): Record<string, string> {
  const parse = (value: unknown) =>
    value == null || String(value).trim() === ""
      ? null
      : Number(String(value).replace(/\s/g, "").replace(",", "."));
  const start = parse(values.startKm),
    end = parse(values.endKm);
  return start !== null &&
    end !== null &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    end <= start
    ? {
        endKm: `Koncový tachometr musí být vyšší než počáteční (${new Intl.NumberFormat("cs-CZ").format(start)} km).`,
      }
    : {};
}
