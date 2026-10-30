import type { Actor } from "./models";
import type { Command } from "../data/contracts";
import { DomainError } from "./rules";
export function authorizeCommand(actor: Actor, c: Command) {
  if (actor.role !== "Řidič") return;
  if (!actor.driverId)
    throw new DomainError("Nejprve zvolte řidiče.", undefined, 403);
  if (
    c.type === "trip.start" ||
    c.type === "document.delete" ||
    c.type === "document.update"
  )
    return;
  if (c.type === "save" && ["trips", "fuels", "faults"].includes(c.collection))
    return;
  throw new DomainError("K této operaci nemáte oprávnění.", undefined, 403);
}
