import { Link } from "react-router";
import { useFleet } from "../app/context";
import { DataTable, Panel } from "../components/ui";
import { driverTasks } from "../domain/driver-tasks";
import { date } from "../lib/format";

export function DriverTasks() {
  const { s, actor } = useFleet();
  const tasks = driverTasks(s, actor.driverId);
  return (
    <Panel>
      <DataTable
        rows={tasks}
        path={(t) => t.path}
        search={(t) => `${t.title} ${t.detail} ${t.place}`}
        filters={[
          {
            key: "type",
            label: "Všechny typy",
            options: [
              ["trip", "Jízda"],
              ["service", "Servis"],
            ],
            value: (t) => (t.id.startsWith("trip:") ? "trip" : "service"),
          },
        ]}
        columns={[
          {
            key: "title",
            label: "Úkol",
            sort: (t) => t.title,
            render: (t) => <strong>{t.title}</strong>,
          },
          {
            key: "vehicle",
            label: "Vozidlo",
            render: (t) =>
              s.vehicles.find((v) => v.id === t.vehicleId)?.spz ||
              "Vozidlo není dostupné",
          },
          {
            key: "at",
            label: "Datum",
            sort: (t) => t.at,
            render: (t) => date(t.at, true),
          },
          {
            key: "detail",
            label: "Podrobnosti",
            render: (t) => (
              <>
                {t.detail}
                <small>{t.place}</small>
              </>
            ),
          },
          {
            key: "action",
            label: "Akce",
            render: (t) => (
              <Link className="btn" to={t.path}>
                {t.action}
              </Link>
            ),
          },
        ]}
      />
    </Panel>
  );
}
