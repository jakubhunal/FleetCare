import { dateKey } from "../lib/format";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Download, Pencil, Bell, Square } from "lucide-react";
import { useFleet } from "../app/context";
import {
  Back,
  Badge,
  Button,
  DataGrid,
  Dialog,
  Empty,
  Form,
  HistorySwitch,
  Notice,
  PageHead,
  Panel,
  Tabs,
} from "../components/ui";
import { DocumentList } from "./documents";
import { useEditors } from "./editors";
import { DRef, FaultTable, OrderTable, TripsTable, VRef } from "./tables";
import { a6Due, activeAssignment, suitability } from "../domain/rules";
import { date, localTime, money, number, toUtc } from "../lib/format";
import { ExportDialog } from "./reports";
export function OrdersPage() {
  const { s } = useFleet();
  return (
    <>
      <PageHead
        title="Zakázky"
        subtitle="Přepravy přijaté e-mailem, jejich požadavky a přiřazení."
      />

      <Panel>
        <OrderTable rows={s.orders} />
      </Panel>
    </>
  );
}
export function OrderPage() {
  const { id, tab = "overview" } = useParams();
  const { s, actor, show } = useFleet(),
    edit = useEditors();
  const o = s.orders.find((o) => o.id === id);
  if (!o)
    return (
      <Empty
        title="Zakázka není dostupná"
        text="Zkontrolujte odkaz a zvolený kontext."
      />
    );
  return (
    <>
      <Back to={actor.role === "Řidič" ? "/my/orders" : "/orders"}>
        Zakázky
      </Back>
      <PageHead
        title={o.number}
        subtitle={o.customer}
        actions={
          actor.role !== "Řidič" && (
            <>
              <Button onClick={() => edit("orders", o)}>
                <Pencil size={17} />
                Upravit údaje
              </Button>
              <Button
                primary
                onClick={() => show(<OrderAssignmentDialog orderId={o.id} />)}
              >
                Přiřadit vozidlo a řidiče
              </Button>
            </>
          )
        }
      />
      <div className="detail-hero">
        <div>
          <h2>
            {o.stops.map((x) => x.place).join(" → ") || "Trasa není doložena"}
          </h2>
          <p>{o.cargo || "Náklad není doložen"}</p>
          <Badge value={o.state} />
        </div>
      </div>
      <section className="panel">
        <Tabs
          base={`/orders/${o.id}`}
          selected={tab}
          items={[
            ["overview", "Přehled"],
            ["documents", "Dokumenty"],
          ]}
        />
        <div className="detail-body">
          {tab === "documents" ? (
            <DocumentList ownerType="order" ownerId={o.id} />
          ) : tab === "overview" ? (
            <>
              <DataGrid
                items={[
                  ["Zákazník", o.customer],
                  ["Kontakt", o.contact || null],
                  ["Reference", o.reference || null],
                  ["Hmotnost", number(o.weightKg, "kg")],
                  ["Objem", number(o.volumeM3, "m³")],
                  ["Palety", number(o.pallets)],
                  ["Rozměry nákladu", o.dimensions || null],
                  ["Vybavení", o.equipment.join(", ") || null],
                  ["Skupina ŘP", o.licence || null],
                  ["Kvalifikace", o.qualifications.join(", ") || null],
                  ["Vozidlo", <VRef id={o.vehicleId} />],
                  ["Řidič zakázky", <DRef id={o.driverId} />],
                  ...(actor.role !== "Řidič"
                    ? ([
                        ["Cena bez DPH", money(o.priceMinor, o.currency)],
                        ["DPH", number(o.vat, "%")],
                        ["Manažerská poznámka", o.internalNote || null],
                      ] as [string, React.ReactNode][])
                    : []),
                ]}
              />
              <h3 className="section-title">Objednané zastávky</h3>
              {o.stops.map((stop) => (
                <div className="stop" key={stop.id}>
                  <div className="stop-dot" />
                  <div>
                    <h3>
                      {stop.type} · {stop.place || "Místo není doloženo"}
                    </h3>
                    <p>
                      {date(stop.from, true)} — {date(stop.to, true)}
                    </p>
                    <small>
                      {stop.contact} {stop.instructions}
                    </small>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <Empty
              title="Část detailu neexistuje"
              text="Vyberte Přehled nebo Dokumenty."
            />
          )}
        </div>
      </section>
    </>
  );
}
export function OrderAssignmentDialog({ orderId }: { orderId: string }) {
  const { s, actor, run, close } = useFleet();
  const o = s.orders.find((o) => o.id === orderId);
  const [vehicleId, setVehicle] = useState(o?.vehicleId || "");
  const [driverId, setDriver] = useState(o?.driverId || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!o || actor.role === "Řidič") return null;
  const vehicle = s.vehicles.find((v) => v.id === vehicleId) || null;
  const vehicles = s.vehicles.filter(
    (v) => suitability(s, o, v, null).state === "Vhodné",
  );
  const drivers = vehicle
    ? s.drivers.filter((d) => suitability(s, o, vehicle, d).state === "Vhodné")
    : [];
  const valid =
    vehicles.some((v) => v.id === vehicleId) &&
    drivers.some((d) => d.id === driverId);
  return (
    <Dialog
      title="Přiřadit vozidlo a řidiče"
      onClose={close}
      dirty={
        vehicleId !== (o.vehicleId || "") || driverId !== (o.driverId || "")
      }
    >
      <div className="dialog-body">
        <div className="two-columns">
          <Panel title="Vozidlo">
            {vehicles.map((v) => (
              <label className="candidate" key={v.id}>
                <input
                  type="radio"
                  name="vehicle"
                  checked={vehicleId === v.id}
                  onChange={() => {
                    setVehicle(v.id);
                    setDriver("");
                  }}
                />
                <span>
                  <strong>
                    {v.spz} · {v.model}
                  </strong>
                  <small>
                    {number(v.capacityKg, "kg")} · {number(v.volumeM3, "m³")}
                  </small>
                </span>
              </label>
            ))}
            {!vehicles.length && (
              <p className="muted">Žádné doloženě vhodné vozidlo.</p>
            )}
          </Panel>
          <Panel title="Řidič zakázky">
            {drivers.map((d) => (
              <label className="candidate" key={d.id}>
                <input
                  type="radio"
                  name="driver"
                  checked={driverId === d.id}
                  onChange={() => setDriver(d.id)}
                />
                <strong>{d.name}</strong>
              </label>
            ))}
            {!drivers.length && (
              <p className="muted">
                {vehicle
                  ? "Žádný doloženě vhodný řidič."
                  : "Nejprve vyberte vozidlo."}
              </p>
            )}
          </Panel>
        </div>
        {error && <Notice error>{error}</Notice>}
        <div className="form-actions">
          <Button
            primary
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await run({
                  type: "order.assign",
                  id: o.id,
                  version: o.version,
                  vehicleId,
                  driverId,
                });
                close();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Přiřazení selhalo.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Ukládání…" : "Uložit přiřazení"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
export function TripsPage() {
  const { s, show } = useFleet();
  const [params, setParams] = useSearchParams();
  const from = params.get("from") || "",
    to = params.get("to") || "";
  return (
    <>
      <PageHead
        title="Přehled jízd"
        subtitle="Skutečně uskutečněné jízdy, tachometry a provozní souvislosti."
        actions={
          <Button primary onClick={() => show(<ExportDialog kind="trips" />)}>
            <Download size={17} />
            Export knihy jízd
          </Button>
        }
      />
      <div className="period-bar">
        <label>
          Období od
          <input
            type="date"
            value={from}
            onChange={(e) => {
              const p = new URLSearchParams(params);
              p.set("from", e.target.value);
              setParams(p);
            }}
          />
        </label>
        <label>
          Období do
          <input
            type="date"
            value={to}
            onChange={(e) => {
              const p = new URLSearchParams(params);
              p.set("to", e.target.value);
              setParams(p);
            }}
          />
        </label>
      </div>
      <Panel>
        <TripsTable
          rows={s.trips.filter(
            (t) =>
              (!from || dateKey(t.startAt) >= from) &&
              (!to || dateKey(t.startAt) <= to),
          )}
        />
      </Panel>
    </>
  );
}
export function TripPage() {
  const { id } = useParams();
  const { s, actor, run } = useFleet(),
    edit = useEditors();
  const [error, setError] = useState("");
  const t = s.trips.find((t) => t.id === id);
  if (!t)
    return (
      <Empty
        title="Jízda není dostupná"
        text="Záznam neexistuje nebo není ve vašem kontextu."
      />
    );
  const canEdit =
    t.state !== "Uzavřena" &&
    (actor.role !== "Řidič" || t.state !== "Potvrzena");
  return (
    <>
      <Back to={actor.role === "Řidič" ? "/my/trips" : "/trips"}>
        Přehled jízd
      </Back>
      <PageHead
        title={t.from + " → " + (t.to || "Na trase")}
        subtitle={date(t.startAt, true)}
        actions={
          <>
            {canEdit && (
              <Button
                primary={t.state === "Probíhá"}
                onClick={() =>
                  edit(
                    "trips",
                    t,
                    t.state === "Probíhá"
                      ? { endAt: new Date().toISOString() }
                      : undefined,
                  )
                }
              >
                {t.state === "Probíhá" ? (
                  <Square size={17} />
                ) : (
                  <Pencil size={17} />
                )}
                {t.state === "Probíhá" ? "Ukončit jízdu" : "Upravit údaje"}
              </Button>
            )}
            {actor.role !== "Řidič" &&
              ["K ověření", "Potvrzena"].includes(t.state) && (
                <Button
                  onClick={async () => {
                    try {
                      await run({
                        type: "trip.transition",
                        id: t.id,
                        version: t.version,
                        state:
                          t.state === "K ověření" ? "Potvrzena" : "Uzavřena",
                      });
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Uložení selhalo.",
                      );
                    }
                  }}
                >
                  {t.state === "K ověření"
                    ? "Potvrdit údaje jízdy"
                    : "Uzavřít jízdu"}
                </Button>
              )}
          </>
        }
      />
      {error && <Notice error>{error}</Notice>}
      {t.endAt && t.endKm === null && (
        <Notice error>
          Chybí koncový tachometr. Skutečný konec: {date(t.endAt, true)}.{" "}
          {a6Due(t)
            ? "Od ukončení uplynulo 72 hodin; připraveno pro nejbližší denní kontrolu A6."
            : "A6 bude způsobilé až po 72 hodinách od ukončení."}
        </Notice>
      )}
      <Panel title="Skutečný průběh">
        <div className="section-actions">
          <Badge value={t.state} />
        </div>
        <DataGrid
          items={[
            ["Vozidlo", <VRef id={t.vehicleId} />],
            ["Řidič", <DRef id={t.driverId} />],
            [
              "Zakázka / vlastní účel",
              t.orderId ? (
                <Link to={`/orders/${t.orderId}`}>
                  {s.orders.find((o) => o.id === t.orderId)?.number}
                </Link>
              ) : (
                t.purpose
              ),
            ],
            ["Začátek", date(t.startAt, true)],
            ["Konec", date(t.endAt, true)],
            ["Místo od", t.from],
            ["Místo do", t.to || null],
            ["Počáteční tachometr", number(t.startKm, "km")],
            ["Koncový tachometr", number(t.endKm, "km")],
            [
              "Doložené kilometry",
              number(t.endKm === null ? null : t.endKm - t.startKm, "km"),
            ],
            ["Zdroj", t.source],
            ["Poznámka", t.note || null],
          ]}
        />
      </Panel>
    </>
  );
}
export function FaultsPage() {
  const { s } = useFleet(),
    edit = useEditors();
  const [historical, setHistorical] = useState(false);
  return (
    <>
      <PageHead
        title="Servis a závady"
        subtitle="Od hlášení po externí opravu a návrat do provozu."
      />
      <Panel>
        <FaultTable
          toolbarActions={
            <>
              <Button primary onClick={() => edit("faults")}>
                Nahlásit závadu
              </Button>
              <HistorySwitch checked={historical} onChange={setHistorical} />
            </>
          }
          rows={s.faults.filter((f) => historical || f.state !== "Uzavřena")}
        />
      </Panel>
    </>
  );
}
export function FaultPage() {
  const { id } = useParams();
  const { s, actor, show } = useFleet(),
    edit = useEditors();
  const f = s.faults.find((f) => f.id === id);
  if (!f) return <Empty title="Závada není dostupná" />;
  const service = s.services.find((x) => x.id === f.serviceId);
  return (
    <>
      <Back to={actor.role === "Řidič" ? "/my/requests" : "/faults"}>
        {actor.role === "Řidič" ? "Moje úkoly" : "Závady"}
      </Back>
      <PageHead
        title={f.description}
        subtitle={f.caseReference}
        actions={
          actor.role !== "Řidič" && (
            <>
              <Button onClick={() => edit("faults", f)}>
                <Pencil size={17} />
                Upravit
              </Button>
              <Button onClick={() => show(<NotifyDialog faultId={f.id} />)}>
                <Bell size={17} />
                Notifikovat řidiče
              </Button>
            </>
          )
        }
      />
      <Panel title="Hlášení a servis">
        <p>
          <Badge value={f.state} />
        </p>
        <DataGrid
          items={[
            ["Vozidlo", <VRef id={f.vehicleId} />],
            ["Nahlášeno", date(f.at, true)],
            ["Kategorie", f.category],
            ["Oznámená naléhavost", f.urgency],
            ["Tachometr", number(f.km, "km")],
            ["Externí servis", service?.name || null],
            ["Servis od", date(f.serviceFrom, true)],
            ["Servis do", date(f.serviceTo, true)],
            ["Provozní nedostupnost", f.unavailable ? "Ano" : "Ne"],
            ["Popis opravy", f.repair || null],
            ...(actor.role !== "Řidič"
              ? ([
                  ["Odhad ceny", money(f.estimateMinor, f.currency)],
                  [
                    "Původ odhadu",
                    f.estimateSource || "Čeká na e-mail servisu",
                  ],
                  ["Odhad přijat", date(f.estimateAt, true)],
                  ["Skutečná cena", money(f.actualMinor, f.currency)],
                ] as [string, React.ReactNode][])
              : []),
          ]}
        />
      </Panel>
      {actor.role !== "Řidič" && (
        <>
          <Panel title="Komunikační požadavky">
            {s.notifications
              .filter((n) => n.aggregateId === f.id)
              .map((n) => (
                <div className="list-item" key={n.id}>
                  <div>
                    <strong>
                      {
                        {
                          driver: "Řidič",
                          manager: "Fleet manažer",
                          service: "Externí servis",
                        }[n.recipientRole]
                      }
                    </strong>
                    <small>
                      {n.email || "Kontakt chybí"} · {n.reason}
                    </small>
                  </div>
                  <Badge value={n.state} />
                  <Button
                    disabled={["sent", "sending"].includes(n.state)}
                    onClick={() => show(<RecipientDialog id={n.id} />)}
                  >
                    Změnit příjemce
                  </Button>
                </div>
              ))}
          </Panel>
          <Panel title="Podklady ze servisu">
            <DocumentList
              ownerType="fault"
              ownerId={f.id}
              vehicleId={f.vehicleId}
            />
          </Panel>
          <Notice>
            Odhad není skutečný náklad. Doložený výdaj z opravy zapište v
            Náklady a CCS. Provedené položky plánu zaznamenejte jednotlivě u
            vozidla.
          </Notice>
          <Link className="btn" to={`/vehicles/${f.vehicleId}/plan`}>
            Servisní plán vozidla →
          </Link>
        </>
      )}
    </>
  );
}
function NotifyDialog({ faultId }: { faultId: string }) {
  const { s, run, close } = useFleet();
  const f = s.faults.find((f) => f.id === faultId)!;
  const a = activeAssignment(s, f.vehicleId);
  const d = s.drivers.find((d) => d.id === a?.driverId);
  return (
    <Dialog title="Notifikovat řidiče o servisu" onClose={close}>
      <div className="dialog-body">
        <Notice>
          Vytvoří se požadavek na e-mail. V lokálním režimu zůstane stav „Služba
          není připojena“.
        </Notice>
        <Form
          fields={[
            { key: "email", label: "Příjemce", type: "email", required: true },
            {
              key: "serviceAt",
              label: "Termín servisu",
              type: "datetime",
              required: true,
            },
            { key: "place", label: "Místo", required: true },
            {
              key: "message",
              label: "Zpráva",
              type: "textarea",
              required: true,
            },
          ]}
          initial={{
            email: d?.email || "",
            serviceAt: f.serviceFrom ? localTime(f.serviceFrom) : "",
            place: s.services.find((x) => x.id === f.serviceId)?.address || "",
            message: `Vozidlo má domluven servis. Reference ${f.caseReference}.`,
          }}
          submit="Vytvořit požadavek na e-mail"
          onSubmit={async (v) => {
            await run({
              type: "fault.notify",
              id: faultId,
              email: String(v.email),
              serviceAt: toUtc(String(v.serviceAt)),
              place: String(v.place),
              message: String(v.message),
            });
            close();
          }}
        />
      </div>
    </Dialog>
  );
}

function RecipientDialog({ id }: { id: string }) {
  const { s, run, close } = useFleet();
  const n = s.notifications.find((n) => n.id === id)!;
  const [dirty, setDirty] = useState(false);
  return (
    <Dialog title="Změnit příjemce" onClose={close} dirty={dirty}>
      <div className="dialog-body">
        <Form
          fields={[
            {
              key: "email",
              label: "E-mail příjemce",
              type: "email",
              required: true,
            },
          ]}
          initial={{ email: n.email || "" }}
          onDirty={setDirty}
          onSubmit={async (v) => {
            await run({
              type: "notification.recipient",
              id: n.id,
              version: n.version,
              email: String(v.email),
            });
            close();
          }}
        />
      </div>
    </Dialog>
  );
}
