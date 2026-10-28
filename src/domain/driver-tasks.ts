import type { Workspace } from "./models";
import { availableVehicles } from "./rules";

export function driverTasks(s: Workspace, driverId: string | null) {
  if (!driverId) return [];
  const vehicles = new Set(availableVehicles(s, driverId).map((v) => v.id));
  return [
    ...s.trips
      .filter((t) => t.driverId === driverId && t.endAt && t.endKm === null)
      .map((t) => ({
        id: `trip:${t.id}`,
        title: "Doplnit koncový tachometr",
        detail: `${t.from} → ${t.to || "Cíl není doplněn"}`,
        vehicleId: t.vehicleId,
        at: t.startAt,
        place: "",
        path: `/trips/${t.id}`,
        action: "Doplnit tachometr",
      })),
    ...s.faults
      .filter(
        (f) =>
          vehicles.has(f.vehicleId) &&
          f.state === "Naplánován servis" &&
          f.serviceFrom,
      )
      .map((f) => {
        const service = s.services.find((x) => x.id === f.serviceId);
        return {
          id: `service:${f.id}`,
          title: "Zajet s vozidlem na servis",
          detail: f.description,
          vehicleId: f.vehicleId,
          at: f.serviceFrom!,
          place:
            [service?.name, service?.address].filter(Boolean).join(" · ") ||
            "Místo servisu není doplněno — ověřte u fleet manažera.",
          path: `/faults/${f.id}`,
          action: "Detail servisu",
        };
      }),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}
