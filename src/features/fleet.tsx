import { DocumentLink } from "./documents";
import type { ReactNode } from "react";
import { useState } from "react";
import { useParams } from "react-router";
import { Truck, UserPlus, Pencil, Pause, Play } from "lucide-react";
import { useFleet, Confirm } from "../app/context";
import {
  Back,
  Badge,
  Button,
  DataGrid,
  DataTable,
  Dialog,
  Empty,
  Form,
  HistorySwitch,
  Notice,
  PageHead,
  Panel,
  Tabs,
} from "../components/ui";
import { useEditors } from "./editors";
import { AddVehicleButton } from "./vehicle-intake";
import { DocumentList } from "./documents";
import {
  DRef,
  VRef,
  DriverTable,
  DriverOperationsTable,
  FaultTable,
  FuelTable,
  OrderTable,
  TripsTable,
  VehicleTable,
} from "./tables";
import { activeAssignment, driverState, odometer } from "../domain/rules";
import { date, localTime, number, toUtc } from "../lib/format";
import type { Vehicle } from "../domain/models";
export function VehiclesPage() {
  const { s } = useFleet();
  const intake = s.documents.filter(
    (d) => d.ownerType === "intake" && !d.deletedAt,
  );
  return (
    <>
      <PageHead
        title="Vozidla"
        subtitle="Váš vozový park, jeho dostupnost a nejbližší povinnosti."
      />
      <Panel>
        <VehicleTable rows={s.vehicles} toolbarActions={<AddVehicleButton />} />
      </Panel>
      {!!intake.length && (
        <Panel title="STK pro založení vozidla">
          {intake.map((d) => (
            <p key={d.id}>
              <DocumentLink to={`/documents/${d.id}`}>{d.name}</DocumentLink>{" "}
              <Badge value={d.extraction} />
            </p>
          ))}
        </Panel>
      )}
    </>
  );
}
export function DriversPage() {
  const { s } = useFleet(),
    edit = useEditors();
  return (
    <>
      <PageHead
        title="Řidiči"
        subtitle="Lidé, oprávnění a dostupnost vašeho týmu."
      />
      <Panel>
        <DriverTable
          rows={s.drivers}
          toolbarActions={
            <Button primary onClick={() => edit("drivers")}>
              <UserPlus size={18} />
              Přidat řidiče
            </Button>
          }
        />
      </Panel>
    </>
  );
}
const vehicleTabs: [string, string][] = [
  ["overview", "Přehled"],
  ["documents", "Dokumenty"],
  ["plan", "Servisní plán"],
  ["faults", "Závady a servis"],
  ["orders", "Zakázky"],
  ["trips", "Jízdy a nájezdy"],
  ["costs", "Tankování a náklady"],
  ["assignments", "Přidělení"],
];
export function VehiclePage() {
  const { id, tab = "overview" } = useParams();
  const { s, actor, show } = useFleet(),
    edit = useEditors();
  const v = s.vehicles.find((v) => v.id === id);
  if (!v)
    return (
      <Empty
        title="Vozidlo není dostupné"
        text="Vraťte se do evidence nebo zvolte dostupné vozidlo."
      />
    );
  const a = activeAssignment(s, v.id);
  return (
    <>
      <Back to="/vehicles">Všechna vozidla</Back>
      <PageHead
        title={v.spz}
        subtitle="Detail vozidla"
        actions={
          actor.role !== "Řidič" && (
            <>
              <Button onClick={() => edit("vehicles", v)}>
                <Pencil size={17} />
                Upravit informace o vozidle
              </Button>
            </>
          )
        }
      />
      <div className="detail-hero">
        <div className="vehicle-icon">
          <Truck size={60} />
        </div>
        <div>
          <h2>{v.model}</h2>
          <p>
            {v.category} · {v.year || "Rok není doložen"} ·{" "}
            {v.purpose || "Účel není uveden"}
          </p>
          <Badge value={v.state} />{" "}
          {v.reserve && <span className="badge gray">Provozní rezerva</span>}
        </div>
        <div className="hero-aside">
          <small>Svěřený řidič</small>
          <DRef id={a?.driverId || null} />
        </div>
      </div>
      <section className="panel">
        <Tabs items={vehicleTabs} base={`/vehicles/${v.id}`} selected={tab} />
        <div className="detail-body">
          {tab === "overview" && (
            <DataGrid
              items={[
                ["SPZ", v.spz],
                ["VIN", v.vin || null],
                ["Kategorie", v.category],
                ["Provozní účel", v.purpose || null],
                [
                  "Motorizace / palivo",
                  [v.engine, v.fuel].filter(Boolean).join(" · ") || null,
                ],
                ["Doložený nájezd", number(odometer(s, v.id), "km")],
                ["Požadované ŘP", v.licence || null],
                ["Nosnost", number(v.capacityKg, "kg")],
                ["Objem", number(v.volumeM3, "m³")],
                ["Palety", number(v.pallets)],
                ["Rozměry", v.dimensions || null],
                ["Konfigurace soupravy", v.configuration || null],
                ["Vybavení", v.equipment.join(", ") || null],
                [
                  "Nasmlouvaný servis",
                  s.services.find((x) => x.id === v.serviceId)?.name || null,
                ],
              ]}
            />
          )}
          {tab === "documents" && (
            <DocumentList ownerType="vehicle" ownerId={v.id} vehicleId={v.id} />
          )}
          {tab === "plan" && <ServicePlan vehicle={v} />}
          {tab === "faults" && (
            <>
              <FaultTable rows={s.faults.filter((f) => f.vehicleId === v.id)} />
            </>
          )}
          {tab === "orders" && (
            <OrderTable rows={s.orders.filter((o) => o.vehicleId === v.id)} />
          )}
          {tab === "trips" && (
            <>
              <TripsTable rows={s.trips.filter((t) => t.vehicleId === v.id)} />
              <h3>Zdroje doloženého nájezdu</h3>
              {s.readings
                .filter((r) => r.vehicleId === v.id)
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((r) => (
                  <div className="list-item" key={r.id}>
                    <span>{date(r.at, true)}</span>
                    <strong>{number(r.km, "km")}</strong>
                    <span>
                      {r.source === "manual"
                        ? "Ruční provozní záznam"
                        : r.source}
                      {odometer(s, v.id) !== null && r.km < odometer(s, v.id)!
                        ? " · Starší / nižší údaj"
                        : ""}
                    </span>
                  </div>
                ))}
            </>
          )}
          {tab === "costs" && (
            <>
              <FuelTable rows={s.fuels.filter((f) => f.vehicleId === v.id)} />
            </>
          )}
          {tab === "assignments" && (
            <>
              <Assignments
                vehicleId={v.id}
                actions={
                  <>
                    <Button
                      primary
                      onClick={() =>
                        show(<AssignmentDialog vehicleId={v.id} />)
                      }
                    >
                      Přiřadit / změnit řidiče
                    </Button>
                    {a && (
                      <Button
                        danger
                        onClick={() =>
                          show(<AssignmentDialog vehicleId={v.id} end />)
                        }
                      >
                        Ukončit přidělení
                      </Button>
                    )}
                  </>
                }
              />
            </>
          )}
          {!vehicleTabs.some(([key]) => key === tab) && (
            <Empty
              title="Část detailu neexistuje"
              text="Vyberte dostupnou záložku."
            />
          )}
        </div>
      </section>
    </>
  );
}
function AssignmentDialog({
  vehicleId,
  end = false,
}: {
  vehicleId: string;
  end?: boolean;
}) {
  const { s, run, close } = useFleet();
  const [dirty, setDirty] = useState(false);
  return (
    <Dialog
      title={end ? "Ukončit přidělení" : "Svěřit vozidlo řidiči"}
      onClose={close}
      dirty={dirty}
    >
      <div className="dialog-body">
        <Form
          danger={end}
          onDirty={setDirty}
          fields={[
            ...(!end
              ? [
                  {
                    key: "driverId",
                    label: "Řidič",
                    type: "select" as const,
                    required: true,
                    options: s.drivers
                      .filter((d) => !d.suspended)
                      .map((d) => [d.id, d.name] as [string, string]),
                  },
                ]
              : []),
            {
              key: "from",
              label: "Účinnost od",
              type: "datetime",
              required: true,
              initial: localTime(),
            },
            { key: "odometer", label: "Předávací nájezd (km)", type: "number" },
            { key: "reason", label: "Důvod", type: "textarea", required: true },
          ]}
          onSubmit={async (values) => {
            await run({
              type: "vehicle.assign",
              vehicleId,
              driverId: end ? null : String(values.driverId),
              from: toUtc(String(values.from)),
              reason: String(values.reason),
              odometer: values.odometer as number | null,
            });
            close();
          }}
        />
      </div>
    </Dialog>
  );
}
function Assignments({
  vehicleId,
  driverId,
  actions,
}: {
  vehicleId?: string;
  driverId?: string;
  actions?: ReactNode;
}) {
  const { s } = useFleet();
  const [historical, setHistorical] = useState(false);
  const now = new Date().toISOString();
  const rows = s.assignments.filter(
    (a) =>
      (!vehicleId || a.vehicleId === vehicleId) &&
      (!driverId || a.driverId === driverId) &&
      (historical || !a.to || a.to > now),
  );
  return (
    <DataTable
      rows={rows}
      prefix={`assignments-${vehicleId || driverId}.`}
      search={(a) => {
        const v = s.vehicles.find((v) => v.id === a.vehicleId);
        return `${v?.spz} ${v?.model} ${s.drivers.find((d) => d.id === a.driverId)?.name} ${a.reason}`;
      }}
      toolbarActions={
        <>
          {actions}
          <HistorySwitch checked={historical} onChange={setHistorical} />
        </>
      }
      columns={[
        driverId
          ? {
              key: "vehicle",
              label: "SPZ / typ vozidla",
              sort: (a) =>
                s.vehicles.find((v) => v.id === a.vehicleId)?.spz || "",
              render: (a) => (
                <>
                  <VRef id={a.vehicleId} />
                  <small>
                    {s.vehicles.find((v) => v.id === a.vehicleId)?.category} ·{" "}
                    {s.vehicles.find((v) => v.id === a.vehicleId)?.model}
                  </small>
                </>
              ),
            }
          : {
              key: "driver",
              label: "Řidič",
              sort: (a) =>
                s.drivers.find((d) => d.id === a.driverId)?.name || "",
              render: (a) => <DRef id={a.driverId} />,
            },
        {
          key: "period",
          label: "Období od–do",
          sort: (a) => a.from,
          render: (a) => (
            <>
              {date(a.from, true)} — {a.to ? date(a.to, true) : "Trvá"}
            </>
          ),
        },
        {
          key: "state",
          label: "Stav",
          render: (a) => (
            <Badge
              value={
                a.to && a.to <= now
                  ? "Ukončeno"
                  : a.from > now
                    ? "Plánováno"
                    : "Aktivní"
              }
            />
          ),
        },
        {
          key: "km",
          label: "Km",
          sort: (a) => a.odometer,
          render: (a) => number(a.odometer, "km"),
        },
        { key: "reason", label: "Důvod", render: (a) => a.reason },
      ]}
    />
  );
}
function ServicePlan({ vehicle }: { vehicle: Vehicle }) {
  const { s } = useFleet(),
    edit = useEditors();
  const p = s.plans.find((p) => p.vehicleId === vehicle.id);
  return (
    <>
      {!p?.items.length && (
        <div className="section-actions">
          <Button onClick={() => edit("plans", p, { vehicleId: vehicle.id })}>
            Vytvořit individuální plán
          </Button>
        </div>
      )}
      <DataTable
        rows={p?.items || []}
        search={(i) => i.name}
        columns={[
          {
            key: "name",
            label: "Úkon",
            sort: (i) => i.name,
            render: (i) => <strong>{i.name}</strong>,
          },
          {
            key: "interval",
            label: "Interval km / měsíců",
            render: (i) => (
              <>
                {number(i.intervalKm, "km")} /{" "}
                {number(i.intervalMonths, "měsíců")}
              </>
            ),
          },
          {
            key: "last",
            label: "Poslední provedení",
            sort: (i) => i.lastDate,
            render: (i) => (
              <>
                {date(i.lastDate)}
                <small>{number(i.lastKm, "km")}</small>
              </>
            ),
          },
          {
            key: "next",
            label: "Další termín / hranice",
            sort: (i) => i.nextDate,
            render: (i) => (
              <>
                {date(i.nextDate)}
                <small>{number(i.nextKm, "km")}</small>
              </>
            ),
          },
          {
            key: "actions",
            label: "Akce",
            render: (i) => (
              <Button
                aria-label={`Upravit individuální plán · ${i.name}`}
                onClick={() => edit("plans", p)}
              >
                <Pencil size={16} />
              </Button>
            ),
          },
        ]}
      />
    </>
  );
}
export function DriverPage() {
  const { id, tab = "overview" } = useParams();
  const { s, run, show, close } = useFleet(),
    edit = useEditors();
  const d = s.drivers.find((d) => d.id === id);
  if (!d)
    return (
      <Empty
        title="Řidič není dostupný"
        text="Zkontrolujte odkaz nebo přístupový kontext."
      />
    );
  return (
    <>
      <Back to="/drivers">Všichni řidiči</Back>
      <PageHead
        title={d.name}
        subtitle="Profil řidiče"
        actions={
          <>
            <Button onClick={() => edit("drivers", d)}>
              <Pencil size={17} />
              Upravit profil
            </Button>
            <Button
              onClick={() =>
                show(
                  <Confirm
                    title={d.suspended ? "Obnovit řidiče" : "Pozastavit řidiče"}
                    description={
                      d.suspended
                        ? "Obnovení zachová všechny ostatní překážky včetně platnosti oprávnění."
                        : "Stávající zakázky zůstanou zachovány."
                    }
                    action={() =>
                      run({
                        type: "driver.toggle",
                        id: d.id,
                        version: d.version,
                      })
                    }
                    onDone={close}
                  />,
                )
              }
            >
              {d.suspended ? <Play size={17} /> : <Pause size={17} />}
              {d.suspended ? "Obnovit řidiče" : "Pozastavit řidiče"}
            </Button>
          </>
        }
      />
      <div className="detail-hero">
        <div className="initials">
          {d.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div>
          <h2>{d.name}</h2>
          <p>
            {d.email || "E-mail není uveden"} ·{" "}
            {d.phone || "Telefon není uveden"}
          </p>
          <Badge value={driverState(d)} />
        </div>
      </div>
      <section className="panel">
        <Tabs
          base={`/drivers/${d.id}`}
          selected={tab}
          items={[
            ["overview", "Přehled"],
            ["documents", "Dokumenty"],
            ["assignments", "Přidělení"],
            ["operations", "Zakázky a jízdy"],
          ]}
        />
        <div className="detail-body">
          {tab === "overview" && (
            <>
              <DataGrid
                items={[
                  ["Pracovní e-mail", d.email || null],
                  ["Pracovní telefon", d.phone || null],
                  ["Stav profilu", driverState(d)],
                ]}
              />
              {(!d.email || !d.phone || !d.licences.length) && (
                <Notice>
                  Profil je rozpracovaný. Doplňte pracovní kontakt a oprávnění.
                </Notice>
              )}
            </>
          )}
          {tab === "documents" && (
            <DocumentList ownerType="driver" ownerId={d.id} />
          )}
          {tab === "assignments" && <Assignments driverId={d.id} />}
          {tab === "operations" && <DriverOperationsTable driverId={d.id} />}
        </div>
      </section>
    </>
  );
}
