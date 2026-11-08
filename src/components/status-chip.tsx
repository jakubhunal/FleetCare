import { statusMetadata, type StatusEntity } from "../lib/status";
/** Same markup and typography in lists, detail grids and dialogs. */
export function StatusChip({
  entity = "generic",
  value,
}: {
  entity?: StatusEntity | "generic";
  value: string;
}) {
  const status = statusMetadata(entity, value);
  return <span className={"badge " + status.variant}>{status.label}</span>;
}
