import { odometerErrors } from "../lib/form-validation";
import { useState } from "react";
import { Link } from "react-router";
import { useFleet } from "../app/context";
import {
  Button,
  Dialog,
  Form,
  DataGrid,
  DataTable,
  Panel,
} from "../components/ui";
import { driverTasks } from "../domain/driver-tasks";
import { date } from "../lib/format";

export function DriverTasks() {
  const { s, actor, show } = useFleet();
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
            key: "reference",
            label: "Zakázka / jízda",
            render: (t) => {
              const trip = s.trips.find((x) => `trip:${x.id}` === t.id);
              const order = s.orders.find((x) => x.id === trip?.orderId);
              return (
                <Link to={order ? `/orders/${order.id}` : t.path}>
                  {order?.number || trip?.purpose || trip?.id || "Servis"}
                </Link>
              );
            },
          },
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
            render: (t) =>
              t.id.startsWith("trip:") ? (
                <Button
                  onClick={() =>
                    show(<CompleteOdometerDialog tripId={t.id.slice(5)} />)
                  }
                >
                  {t.action}
                </Button>
              ) : (
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

export function CompleteOdometerDialog({ tripId }: { tripId: string }) {
  const { s, run, close } = useFleet();
  const [dirty, setDirty] = useState(false);
  const trip = s.trips.find((t) => t.id === tripId);
  if (!trip) return null;
  return (
    <Dialog title="Doplnit tachometr" onClose={close} dirty={dirty}>
      <div className="dialog-body">
        <DataGrid
          items={[
            ["Vozidlo", s.vehicles.find((v) => v.id === trip.vehicleId)?.spz],
            ["Trasa", `${trip.from} → ${trip.to}`],
            ["Datum", date(trip.startAt, true)],
          ]}
        />
        <Form
          onDirty={setDirty}
          initial={{ startKm: trip.startKm }}
          validate={(values) =>
            odometerErrors({ ...values, startKm: trip.startKm })
          }
          fields={[
            {
              key: "endKm",
              label: "Koncový tachometr (km)",
              type: "number",
              required: true,
            },
          ]}
          onSubmit={async (values) => {
            await run({
              type: "save",
              collection: "trips",
              id: trip.id,
              version: trip.version,
              data: { ...trip, ...values, state: "K ověření" },
            });
            close();
          }}
        />
      </div>
    </Dialog>
  );
}
