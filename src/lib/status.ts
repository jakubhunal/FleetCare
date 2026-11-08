import {
  faultStates,
  matchStates,
  orderStates,
  tripStates,
  type Records,
} from "../domain/models";
/** Product specification §5.7, excluding the retired ambiguous-match state. */
export const ccsStatuses = {
  "Čeká na výpis": { label: "Čeká na výpis", variant: "amber" },
  Spárováno: { label: "Spárováno", variant: "green" },
  Rozdíl: { label: "Rozdíl", variant: "red" },
  "Chybí záznam řidiče": { label: "Chybí záznam řidiče", variant: "amber" },
  "Neúplný podklad": { label: "Neúplný podklad", variant: "amber" },
  Vyřešeno: { label: "Vyřešeno", variant: "green" },
} as const;
export type CCSStatus = keyof typeof ccsStatuses;
export const ccsOptions: [CCSStatus, string][] = Object.entries(
  ccsStatuses,
).map(([value, { label }]) => [value as CCSStatus, label]);
/** Ambiguous legacy matches and unknown values require completion, never a guessed link. */
export function ccsStatus(value: string): CCSStatus {
  return Object.hasOwn(ccsStatuses, value)
    ? (value as CCSStatus)
    : "Neúplný podklad";
}

export type StatusVariant = "green" | "red" | "blue" | "gray" | "amber";
export type StatusMetadata = { label: string; variant: StatusVariant };
const variants: Record<string, StatusVariant> = {
  "V provozu": "green",
  Aktivní: "green",
  Potvrzena: "green",
  Uzavřena: "gray",
  Uzavřená: "gray",
  Vyřešena: "green",
  Dokončená: "green",
  Splněno: "green",
  Vhodné: "green",
  Nevhodné: "red",
  Pozastavený: "red",
  Odstaveno: "red",
  "Vyžaduje řešení": "red",
  failed: "red",
  upload_failed: "red",
  Probíhá: "blue",
  "V servisu": "blue",
  "Řeší se": "blue",
  Přiřazená: "blue",
  processing: "blue",
};
const labels: Record<string, string> = {
  not_configured: "Služba není připojena",
  not_required: "Bez extrakce",
  stored: "Soubor uložen",
  uploading: "Ukládání",
  upload_failed: "Uložení selhalo",
  queued: "Čeká na zpracování",
  processing: "Zpracovává se",
  completed: "Zpracováno",
  incomplete: "Chybí údaje",
  failed: "Zpracování selhalo",
  sending: "Odesílá se",
  sent: "Odesláno",
  skipped_no_recipient: "Vynecháno — bez řidiče",
};
const statuses = (values: readonly string[]): Record<string, StatusMetadata> =>
  Object.fromEntries(
    values.map((value) => [
      value,
      { label: labels[value] || value, variant: variants[value] || "amber" },
    ]),
  );
const processingStatuses = statuses([
  "not_configured",
  "not_required",
  "queued",
  "processing",
  "completed",
  "incomplete",
  "failed",
]);
export const statusMaps = {
  ccs: ccsStatuses,
  vehicle: statuses(["V provozu", "V servisu", "Odstaveno"]),
  driver: statuses(["Aktivní", "Rozpracovaný", "Pozastavený"]),
  assignment: statuses(["Aktivní", "Plánováno", "Ukončeno"]),
  trip: statuses(tripStates),
  order: statuses(orderStates),
  fault: statuses(faultStates),
  deadline: statuses(["Plánováno", "Vyžaduje řešení", "Splněno"]),
  file: statuses(["uploading", "stored", "upload_failed"]),
  processing: processingStatuses,
  statement: processingStatuses,
  card: statuses(["Aktivní", "Neaktivní"]),
  notification: {
    ...statuses([
      "not_configured",
      "queued",
      "sending",
      "sent",
      "failed",
      "skipped_no_recipient",
    ]),
    queued: { label: "Čeká na odeslání", variant: "amber" },
    failed: { label: "Odeslání selhalo", variant: "red" },
  },
} satisfies Record<string, Record<string, StatusMetadata>>;
export type StatusEntity = keyof typeof statusMaps;
export function statusMetadata(
  entity: StatusEntity | "generic",
  value: string,
): StatusMetadata {
  if (
    entity === "ccs" ||
    (entity === "generic" && (matchStates as readonly string[]).includes(value))
  )
    return ccsStatuses[ccsStatus(value)];
  if (entity !== "generic") {
    const map: Record<string, StatusMetadata> = statusMaps[entity];
    return map[value] || { label: value || "Není doloženo", variant: "amber" };
  }
  return {
    label: labels[value] || value || "Není doloženo",
    variant: variants[value] || "amber",
  };
}
export function assignmentState(
  a: Pick<Records["assignments"], "from" | "to">,
  now = new Date().toISOString(),
) {
  return a.to && a.to <= now
    ? "Ukončeno"
    : a.from > now
      ? "Plánováno"
      : "Aktivní";
}
