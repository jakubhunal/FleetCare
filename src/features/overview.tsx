import { transactionState } from "../domain/ccs";
import { StatusChip } from "../components/status-chip";
import { useHistory } from "../lib/history";
import { DeadlineDateDialog, deadlineEdit } from "./deadline-editor";
import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  Truck,
  Plus,
  UserPlus,
  Wrench,
  Receipt,
  Fuel as FuelIcon,
  Play,
  Square,
  List,
  CalendarDays,
} from "lucide-react";
import { useFleet } from "../app/context";
import {
  Back,
  ChoiceButton,
  DataGrid,
  HistorySwitch,
  ViewToggle,
  Button,
  DataTable,
  Empty,
  Notice,
  PageHead,
  Panel,
} from "../components/ui";
import { useEditors } from "./editors";
import { DocumentList } from "./documents";
import { useAddVehicle } from "./vehicle-intake";
import { DRef, VRef } from "./tables";
import { DriverTasks, CompleteOdometerDialog } from "./driver-tasks";
import { FaultTable, FuelTable, OrderTable, TripsTable } from "./tables";
import { Kpi } from "./reports";
import { FuelIntakeDialog } from "./fuel-intake";
import { availableVehicles, deadlines, odometer } from "../domain/rules";
import { date, number, today } from "../lib/format";
import { tripStatus } from "../domain/models";
export function Dashboard() {
  const { s, actor } = useFleet(),
    edit = useEditors(),
    addVehicle = useAddVehicle();
  const due = deadlines(s).filter((d) => d.state !== "Splněno");
  const near = due.filter(
    (d) =>
      d.state === "Vyžaduje řešení" ||
      (!!d.date &&
        s.settings.daysBefore &&
        d.date <=
          new Date(Date.now() + Math.max(...s.settings.daysBefore) * 86400000)
            .toISOString()
            .slice(0, 10)),
  );
  const tasks = [
    ...s.orders
      .filter((o) => !o.vehicleId || !o.driverId)
      .map((o) => ({
        id: o.id,
        title: "Přiřadit · " + o.number,
        meta: o.customer,
        term: o.stops[0]?.from || null,
        state: o.state,
        owner: "Fleet manažer",
        path: `/orders/${o.id}`,
      })),
    ...s.trips
      .filter((t) => t.endAt && t.endKm === null)
      .map((t) => ({
        id: t.id,
        title: "Doplnit koncový tachometr",
        meta: s.vehicles.find((v) => v.id === t.vehicleId)?.spz || "",
        term: t.endAt,
        state: tripStatus(t),
        owner: s.drivers.find((d) => d.id === t.driverId)?.name || "Řidič",
        path: `/trips/${t.id}`,
      })),
    ...s.transactions
      .filter(
        (t) => !["Spárováno", "Vyřešeno"].includes(transactionState(s, t)),
      )
      .map((t) => ({
        id: t.id,
        title: "Vyřešit CCS podklady",
        meta: t.externalId,
        term: t.at,
        state: transactionState(s, t),
        owner: "Fleet manažer",
        path: `/transactions/${t.id}`,
      })),
  ];
  return (
    <>
      <div className="date-heading">
        {new Intl.DateTimeFormat("cs-CZ", {
          dateStyle: "full",
          timeZone: "Europe/Prague",
        }).format(new Date())}
      </div>
      <PageHead
        title="Vše důležité na jednom místě"
        subtitle="Přehled vašeho vozového parku a toho, co potřebuje pozornost."
        actions={
          actor.role === "Vedení" && (
            <Link className="btn" to="/reports">
              Měsíční report
            </Link>
          )
        }
      />
      <h2 className="section-title">Rychlé akce</h2>
      <div className="quick-grid">
        {[
          {
            label: "Přidat vozidlo",
            icon: Truck,
            action: addVehicle,
          },
          {
            label: "Přidat řidiče",
            icon: UserPlus,
            action: () => edit("drivers"),
          },
          {
            label: "Nahlásit závadu",
            icon: Wrench,
            action: () => edit("faults"),
          },
          {
            label: "Zapsat výdaj",
            icon: Receipt,
            action: () => edit("expenses"),
          },
        ].map((a) => (
          <button key={a.label} className="quick-action" onClick={a.action}>
            {a.label.startsWith("Přidat") ? (
              <Plus size={23} />
            ) : (
              <a.icon size={23} />
            )}
            <span>{a.label}</span>
          </button>
        ))}
      </div>
      <div className="kpi-grid">
        <Kpi
          label="Vozový park"
          value={number(s.vehicles.length)}
          hint={`${s.vehicles.filter((v) => v.state === "V provozu").length} v provozu · ${s.vehicles.filter((v) => v.reserve).length} rezervních`}
        />
        <Kpi
          label="Blížící se termíny"
          value={number(near.length)}
          hint={
            s.settings.daysBefore
              ? "Podle nastavených prahů"
              : "Prahy upozornění nejsou nastaveny"
          }
        />
        <Kpi
          label="Otevřené závady"
          value={number(
            s.faults.filter((f) => !["Vyřešena", "Uzavřena"].includes(f.state))
              .length,
          )}
          hint={`${s.faults.filter((f) => f.state === "V servisu").length} vozidel řešeno v servisu`}
        />
        <Kpi
          label="Zakázky k přiřazení"
          value={number(
            s.orders.filter((o) => !o.vehicleId || !o.driverId).length,
          )}
          hint={`${s.orders.filter((o) => o.state === "Probíhá").length} přeprav právě probíhá`}
        />
      </div>
      <div className="dashboard-columns">
        <Panel
          title="Prioritní úkoly"
          action={<span className="count">{tasks.length}</span>}
        >
          {tasks.length ? (
            <DataTable
              rows={tasks}
              path={(x) => x.path}
              search={(x) => x.title + " " + x.meta}
              columns={[
                {
                  key: "title",
                  label: "Úkol / souvislost",
                  sort: (x) => x.title,
                  render: (x) => (
                    <>
                      <strong>{x.title}</strong>
                      <small>{x.meta}</small>
                    </>
                  ),
                },
                {
                  key: "term",
                  label: "Termín",
                  sort: (x) => x.term,
                  render: (x) => date(x.term),
                },
                { key: "owner", label: "Odpovědnost", render: (x) => x.owner },
                {
                  key: "state",
                  label: "Stav",
                  render: (x) => <StatusChip value={x.state} />,
                },
              ]}
            />
          ) : (
            <Empty
              title={
                s.vehicles.length
                  ? "Vše je zatím v pořádku"
                  : "Začněte svým vozovým parkem"
              }
              text={
                s.vehicles.length
                  ? "Z dostupných záznamů nevyplývají žádné otevřené úkoly."
                  : "Přidejte první vozidlo a řidiče. Váš provozní přehled se začne skládat z uložených údajů."
              }
              action={
                !s.vehicles.length && (
                  <Button primary onClick={addVehicle} aria-haspopup="dialog">
                    <Plus size={17} />
                    Přidat první vozidlo
                  </Button>
                )
              }
            />
          )}
        </Panel>
        <Panel title="Nejbližší termíny">
          {due.slice(0, 5).map((d) => (
            <Link className="deadline-item" to={d.path} key={d.id}>
              <div className="date-box">
                <b>{d.date ? Number(d.date.slice(8, 10)) : "km"}</b>
                <small>
                  {d.date
                    ? new Intl.DateTimeFormat("cs-CZ", {
                        month: "short",
                      }).format(new Date(d.date + "T12:00:00Z"))
                    : number(d.km)}
                </small>
              </div>
              <div>
                <strong>{d.title}</strong>
                <small>
                  {d.owner} · {d.state}
                </small>
              </div>
            </Link>
          ))}
          {!due.length && (
            <Empty
              title="Žádné termíny"
              text="Doplňte STK, pojištění nebo servisní plán."
            />
          )}
          <Link className="text-link" to="/deadlines">
            Zobrazit všechny termíny →
          </Link>
        </Panel>
      </div>
      <Panel
        title="Aktuální přepravy"
        action={<Link to="/orders">Všechny zakázky →</Link>}
      >
        <OrderTable
          rows={s.orders.filter(
            (o) => !["Uzavřená", "Zrušená"].includes(o.state),
          )}
        />
      </Panel>
    </>
  );
}
export function DeadlinesPage() {
  const { s } = useFleet(),
    edit = useEditors();
  const [calendar, setCalendar] = useState(false),
    [month, setMonth] = useState(today().slice(0, 7));
  const { rows, historical, setHistorical } = useHistory(
    deadlines(s),
    (d) => d.state === "Splněno",
  );
  const all = rows.map((d) => ({
    ...d,
    path: `/deadlines/${encodeURIComponent(d.id)}`,
  }));
  const controls = (
    <>
      <ViewToggle
        value={calendar ? "calendar" : "list"}
        onChange={(v) => setCalendar(v === "calendar")}
        items={[
          { value: "list", label: "Seznam", icon: <List size={16} /> },
          {
            value: "calendar",
            label: "Kalendář",
            icon: <CalendarDays size={16} />,
          },
        ]}
      />

      <Button primary onClick={() => edit("deadlines")}>
        <Plus size={17} />
        Přidat termín
      </Button>
      <HistorySwitch checked={historical} onChange={setHistorical} />
    </>
  );
  const year = Number(month.slice(0, 4)),
    m = Number(month.slice(5, 7)) - 1;
  const first = (new Date(year, m, 1).getDay() + 6) % 7,
    days = new Date(year, m + 1, 0).getDate();
  function shift(delta: number) {
    const d = new Date(year, m + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return (
    <>
      <PageHead
        title="Termíny a upozornění"
        subtitle="Platnosti, časové a kilometrové hranice navázané na skutečné podklady."
      />
      <Panel>
        <div className="toolbar deadline-controls">
          {calendar && (
            <>
              <label>
                Měsíc
                <input
                  type="month"
                  value={month}
                  onChange={(e) => e.target.value && setMonth(e.target.value)}
                />
              </label>
              <Button aria-label="Předchozí měsíc" onClick={() => shift(-1)}>
                ←
              </Button>
              <Button aria-label="Další měsíc" onClick={() => shift(1)}>
                →
              </Button>
            </>
          )}
          <div className="toolbar-actions">{controls}</div>
        </div>
        {calendar ? (
          <>
            <div className="calendar">
              {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((x) => (
                <div className="weekday" key={x}>
                  {x}
                </div>
              ))}
              {Array.from(
                { length: Math.ceil((days + first) / 7) * 7 },
                (_, i) => {
                  const d = i - first + 1,
                    iso = month + "-" + String(d).padStart(2, "0");
                  return (
                    <div
                      key={i}
                      className={
                        (d < 1 || d > days ? "outside " : "") +
                        (iso === today() ? "today" : "")
                      }
                    >
                      {d > 0 && d <= days && (
                        <>
                          <span>{d}</span>
                          {all
                            .filter((x) => x.date === iso)
                            .map((x) => (
                              <Link to={x.path} key={x.id} title={x.title}>
                                {x.title}
                              </Link>
                            ))}
                        </>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </>
        ) : (
          <DataTable
            rows={all}
            path={(d) => d.path}
            search={(d) => d.title + " " + d.owner}
            filters={[
              {
                key: "state",
                label: "Všechny stavy",
                options: ["Plánováno", "Vyžaduje řešení", "Splněno"].map(
                  (x) => [x, x],
                ),
                value: (d) => d.state,
              },
            ]}
            columns={[
              {
                key: "title",
                label: "Termín",
                sort: (d) => d.title,
                render: (d) => (
                  <>
                    <strong>{d.title}</strong>
                    {!d.derived && <small>Ruční termín</small>}
                  </>
                ),
              },
              {
                key: "date",
                label: "Datum / km hranice",
                sort: (d) => d.date,
                render: (d) => (
                  <>
                    {date(d.date)}
                    <small>{number(d.km, "km")}</small>
                  </>
                ),
              },
              {
                key: "owner",
                label: "Odpovědný",
                sort: (d) => d.owner,
                render: (d) => d.owner,
              },
              {
                key: "state",
                label: "Stav",
                sort: (d) => d.state,
                render: (d) => <StatusChip entity="deadline" value={d.state} />,
              },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
export function DriverWorkspace() {
  const { tab = "vehicle" } = useParams();
  const pageTitle: Record<string, string> = {
    vehicle: "Přehled",
    orders: "Moje zakázky",
    trips: "Moje jízdy",
    fault: "Závady",
    fuel: "Tankování",
    requests: "Moje úkoly",
    documents: "Moje dokumenty",
  };
  const { s, actor, show } = useFleet(),
    edit = useEditors();
  const d = s.drivers.find((d) => d.id === actor.driverId),
    vehicles = availableVehicles(s, actor.driverId),
    v = vehicles[0];
  const active = s.trips.find(
    (t) => t.driverId === actor.driverId && tripStatus(t) === "Probíhá",
  );
  const defaults = { driverId: actor.driverId, vehicleId: v?.id };
  if (!d)
    return (
      <>
        <PageHead
          title={pageTitle[tab] || "Váš pracovní prostor"}
          subtitle="Zvolte existujícího řidiče v horní liště."
        />
        <Empty
          title="Řidič není vybrán"
          text="Fleet manažer nejprve založí profil. Přepínač rolí nevytváří žádnou fiktivní osobu."
        />
      </>
    );
  return (
    <div className="driver-workspace">
      {tab === "vehicle" && (
        <div className="date-heading">
          {new Intl.DateTimeFormat("cs-CZ", {
            dateStyle: "full",
            timeZone: "Europe/Prague",
          }).format(new Date())}
        </div>
      )}
      <PageHead
        title={
          tab === "vehicle"
            ? "Dobrý den, " + d.name.split(" ")[0] + "."
            : pageTitle[tab] || "Váš pracovní prostor"
        }
        subtitle={
          tab === "vehicle"
            ? "Váš pracovní den v přehledu. Jeďte bezpečně."
            : undefined
        }
      />
      {d.suspended && (
        <Notice error>
          Váš profil je pozastaven. Kontaktujte fleet manažera.
        </Notice>
      )}
      {tab === "vehicle" && (
        <>
          {v ? (
            <div className="driver-hero">
              <Truck size={70} />
              <div>
                <span>Moje vozidlo · {v.state}</span>
                <h2>{v.spz}</h2>
                <p>
                  {v.model}
                  <br />
                  {number(odometer(s, v.id), "km")} · STK do {date(v.stkUntil)}
                </p>
              </div>
            </div>
          ) : (
            <Notice error>
              Nemáte dostupné vozidlo. Přiřazení vyřeší fleet manažer.
            </Notice>
          )}
          <div className="driver-actions">
            <Button
              primary
              disabled={!v || !!active || d.suspended}
              onClick={() => edit("trips", undefined, defaults, true)}
            >
              <Play size={26} />
              Zahájit jízdu
            </Button>
            <Button
              disabled={!active}
              onClick={() =>
                active &&
                edit("trips", active, { endAt: new Date().toISOString() })
              }
            >
              <Square size={26} />
              Ukončit jízdu
            </Button>
            <Button
              disabled={!v}
              onClick={() => edit("faults", undefined, defaults)}
            >
              <Wrench size={26} />
              Nahlásit závadu
            </Button>
            <Button
              disabled={!v}
              onClick={() => edit("fuels", undefined, defaults)}
            >
              <FuelIcon size={26} />
              Zadat tankování
            </Button>
          </div>
          {s.trips
            .filter((t) => t.endAt && t.endKm === null)
            .map((t) => (
              <Notice key={t.id} error>
                Doplňte koncový tachometr jízdy z {date(t.startAt)}.{" "}
                <Link to={`/trips/${t.id}`}>Otevřít jízdu →</Link>
              </Notice>
            ))}
          <Panel title="Moje aktuální zakázky">
            <OrderTable
              rows={s.orders.filter(
                (o) => !["Uzavřená", "Zrušená"].includes(o.state),
              )}
            />
          </Panel>
        </>
      )}
      {tab === "orders" && (
        <Panel>
          <OrderTable rows={s.orders} />
        </Panel>
      )}
      {tab === "trips" && (
        <Panel>
          <TripsTable
            rows={s.trips}
            toolbarActions={
              <Button
                primary
                disabled={!v || !!active || d.suspended}
                onClick={() => edit("trips", undefined, defaults, true)}
              >
                Zahájit jízdu
              </Button>
            }
          />
        </Panel>
      )}
      {tab === "fault" && (
        <Panel>
          <FaultTable
            rows={s.faults}
            toolbarActions={
              <Button
                primary
                disabled={!v}
                onClick={() => edit("faults", undefined, defaults)}
              >
                Nahlásit závadu
              </Button>
            }
          />
        </Panel>
      )}
      {tab === "fuel" && (
        <Panel>
          <FuelTable
            rows={s.fuels}
            toolbarActions={
              <ChoiceButton
                label="Zadat tankování"
                icon={<Plus size={17} />}
                choices={[
                  {
                    label: "Nahrát účtenku",
                    action: () => show(<FuelIntakeDialog vehicleId={v?.id} />),
                  },
                  {
                    label: "Zadat manuálně",
                    action: () => edit("fuels", undefined, defaults),
                  },
                ]}
              />
            }
          />
        </Panel>
      )}
      {tab === "requests" && <DriverTasks />}
      {tab === "documents" && (
        <Panel>
          <DocumentList ownerType="driver" ownerId={d.id} />
        </Panel>
      )}
    </div>
  );
}

export function DeadlinePage() {
  const { id } = useParams();
  const { s, show } = useFleet();
  const d = deadlines(s).find((d) => d.id === id);
  if (!d) return <Empty title="Termín není dostupný" />;
  const sourceTrip = s.trips.find((t) => d.path === `/trips/${t.id}`);
  const vehicleId =
    sourceTrip?.vehicleId ||
    s.deadlines.find((r) => r.id === d.id)?.vehicleId ||
    (d.path.startsWith("/vehicles/") ? d.path.split("/")[2] : null);
  const driverId =
    sourceTrip?.driverId ||
    s.deadlines.find((r) => r.id === d.id)?.driverId ||
    (d.path.startsWith("/drivers/") ? d.path.split("/")[2] : null);
  const editable = deadlineEdit(s, d);
  return (
    <>
      <Back to="/deadlines">Termíny a upozornění</Back>
      <PageHead
        title={d.title}
        actions={
          sourceTrip && sourceTrip.endKm === null ? (
            <Button
              onClick={() =>
                show(<CompleteOdometerDialog tripId={sourceTrip.id} />)
              }
            >
              Vyřešit
            </Button>
          ) : editable ? (
            <Button onClick={() => show(<DeadlineDateDialog deadline={d} />)}>
              Upravit termín
            </Button>
          ) : null
        }
      />
      <Panel>
        <DataGrid
          items={[
            ["Datum", date(d.date)],
            ["Km hranice", number(d.km, "km")],
            ["Vozidlo", vehicleId ? <VRef id={vehicleId} /> : null],
            ["Odpovědný", driverId ? <DRef id={driverId} /> : d.owner],
            ["Stav", <StatusChip entity="deadline" value={d.state} />],
          ]}
        />
        {d.derived && (
          <p className="muted">
            Odvozený termín se upravuje ve zdrojovém záznamu.
          </p>
        )}
      </Panel>
    </>
  );
}
