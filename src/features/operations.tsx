import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Download, Pencil, Send, Square } from "lucide-react";
import { useFleet } from "../app/context";
import {
  Back,
  Badge,
  Button,
  DataGrid,
  Dialog,
  Empty,
  Form,
  Notice,
  PageHead,
  Panel,
  Tabs,
} from "../components/ui";
import { DocumentList } from "./documents";
import { useEditors } from "./editors";
import { DRef, FaultTable, OrderTable, TripsTable, VRef } from "./tables";
import {
  a6Due,
  activeAssignment,
  orderConflict,
  orderWindow,
  suitability,
} from "../domain/rules";
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
      <Notice>
        Zakázky přicházejí přes připojený příjem objednávek.{" "}
        {s.orders.length
          ? "Již přijaté záznamy můžete doplnit a přiřadit."
          : "Příjem zatím není připojen; evidence čeká na první import."}
      </Notice>
      <Panel>
        <OrderTable rows={s.orders} />
      </Panel>
    </>
  );
}
export function OrderPage() {
  const { id, tab = "overview" } = useParams();
  const { s, actor } = useFleet(),
    edit = useEditors();
  const o = s.orders.find((o) => o.id === id);
  if (!o)
    return (
      <Empty
        title="Zakázka není dostupná"
        text="Zkontrolujte odkaz a zvolený kontext."
      />
    );
  const conflict = actor.role === "Řidič" ? null : orderConflict(s, o);
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
                Doplnit / upravit údaje
              </Button>
              <Link className="btn primary" to={`/orders/${o.id}/assign`}>
                Přiřadit vozidlo a řidiče
              </Link>
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
      {conflict && <Notice error>Konflikt přiřazení: {conflict}</Notice>}
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
              <Notice>
                Dokončení zakázky, ukončení jízdy a nahrání dodacího listu jsou
                samostatné operace.
              </Notice>
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
export function AssignmentPage() {
  const { id } = useParams();
  const { s, actor, run } = useFleet();
  const o = s.orders.find((o) => o.id === id);
  const [vehicleId, setVehicle] = useState(o?.vehicleId || ""),
    [driverId, setDriver] = useState(o?.driverId || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setVehicle(o?.vehicleId || "");
    setDriver(o?.driverId || "");
    setError("");
  }, [o?.id]);
  if (!o || actor.role === "Řidič")
    return <Empty title="Přiřazení není dostupné" />;
  const v = s.vehicles.find((v) => v.id === vehicleId) || null;
  const vs = s.vehicles.map((vehicle) => ({
      vehicle,
      result: suitability(s, o, vehicle, null),
    })),
    ds = s.drivers.map((driver) => ({
      driver,
      result: suitability(s, o, v, driver),
    }));
  const w = orderWindow(o);
  return (
    <>
      <Back to={`/orders/${o.id}`}>{o.number}</Back>
      <PageHead
        title="Přiřadit vozidlo a řidiče"
        subtitle={`${o.number} · ${date(w.from, true)} — ${date(w.to, true)}`}
      />
      <Notice>
        Vhodnost vychází z doložených kapacit, platností, časových oken a
        servisních blokací. Neznámé údaje vyžadují doplnění. Provozní rezerva je
        povolený kandidát.
      </Notice>
      <div className="two-columns">
        <Panel title="Vozidlo">
          <h3>Vhodní kandidáti</h3>
          {vs
            .filter((x) => x.result.state === "Vhodné")
            .map(({ vehicle, result }) => (
              <label
                className={
                  "candidate " + (vehicleId === vehicle.id ? "selected" : "")
                }
                key={vehicle.id}
              >
                <input
                  type="radio"
                  name="vehicle"
                  value={vehicle.id}
                  checked={vehicleId === vehicle.id}
                  onChange={() => {
                    setVehicle(vehicle.id);
                    setDriver("");
                  }}
                />
                <span>
                  <strong>
                    {vehicle.spz} · {vehicle.model}
                  </strong>
                  <small>
                    {number(vehicle.capacityKg, "kg")} ·{" "}
                    {number(vehicle.volumeM3, "m³")} ·{" "}
                    {number(vehicle.pallets, "palet")}
                    {vehicle.reserve ? " · Rezerva" : ""}
                  </small>
                  <small>
                    Zakázka {date(w.from, true)}–{date(w.to, true)} bez známé
                    kolize
                  </small>
                </span>
                <Badge value={result.state} />
              </label>
            ))}
          {!vs.some((x) => x.result.state === "Vhodné") && (
            <p className="muted">Žádné doloženě vhodné vozidlo.</p>
          )}
          <h3 className="section-title">Nevhodní a nevyhodnotitelní</h3>
          {vs
            .filter((x) => x.result.state !== "Vhodné")
            .map(({ vehicle, result }) => (
              <div className="candidate" key={vehicle.id}>
                <div>
                  <strong>
                    {vehicle.spz} · {vehicle.model}
                  </strong>
                  <p>{result.reasons.join(" · ")}</p>
                </div>
                <Badge value={result.state} />
              </div>
            ))}
        </Panel>
        <Panel title="Řidič zakázky">
          <h3>Vhodní kandidáti</h3>
          {ds
            .filter((x) => x.result.state === "Vhodné")
            .map(({ driver, result }) => (
              <label
                className={
                  "candidate " + (driverId === driver.id ? "selected" : "")
                }
                key={driver.id}
              >
                <input
                  type="radio"
                  name="driver"
                  checked={driverId === driver.id}
                  onChange={() => setDriver(driver.id)}
                />
                <span>
                  <strong>{driver.name}</strong>
                  <small>{driver.licences.map((x) => x.name).join(", ")}</small>
                  <small>
                    {date(w.from, true)}–{date(w.to, true)} bez známé kolize
                  </small>
                </span>
                <Badge value={result.state} />
              </label>
            ))}
          {!ds.some((x) => x.result.state === "Vhodné") && (
            <p className="muted">Žádný doloženě vhodný řidič.</p>
          )}
          <h3 className="section-title">Nevhodní a nevyhodnotitelní</h3>
          {ds
            .filter((x) => x.result.state !== "Vhodné")
            .map(({ driver, result }) => (
              <div className="candidate" key={driver.id}>
                <div>
                  <strong>{driver.name}</strong>
                  <p>{result.reasons.join(" · ")}</p>
                </div>
                <Badge value={result.state} />
              </div>
            ))}
          <Notice>Trvalé svěření vozidla se přiřazením zakázky nemění.</Notice>
          {error && <Notice error>{error}</Notice>}
          <Button
            primary
            disabled={!vehicleId || !driverId || busy}
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
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Přiřazení selhalo.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Ukládání…" : "Uložit přiřazení"}
          </Button>
          {o.vehicleId && (
            <p>
              Uloženo: <VRef id={o.vehicleId} /> · <DRef id={o.driverId} />
            </p>
          )}
        </Panel>
      </div>
    </>
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
              (!from || t.startAt.slice(0, 10) >= from) &&
              (!to || t.startAt.slice(0, 10) <= to),
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
                primary
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
                {t.state === "Probíhá"
                  ? "Ukončit jízdu"
                  : "Doplnit / opravit údaje"}
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
        actions={
          <Button primary onClick={() => edit("faults")}>
            Nahlásit závadu
          </Button>
        }
      />
      <label className="switch">
        <input
          type="checkbox"
          checked={historical}
          onChange={(e) => setHistorical(e.target.checked)}
        />
        Zobrazit i historické
      </label>
      <Panel>
        <FaultTable
          rows={s.faults.filter((f) => historical || f.state !== "Uzavřena")}
        />
      </Panel>
    </>
  );
}
export function FaultPage() {
  const { id } = useParams();
  const { s, actor, show, run } = useFleet(),
    edit = useEditors();
  const [err, setErr] = useState("");
  const f = s.faults.find((f) => f.id === id);
  if (!f) return <Empty title="Závada není dostupná" />;
  const service = s.services.find((x) => x.id === f.serviceId);
  return (
    <>
      <Back to={actor.role === "Řidič" ? "/my/requests" : "/faults"}>
        Závady
      </Back>
      <PageHead
        title={f.description}
        subtitle={f.caseReference}
        actions={
          actor.role !== "Řidič" && (
            <>
              <Button primary onClick={() => edit("faults", f)}>
                Upravit řešení a stav
              </Button>
              <Button onClick={() => show(<NotifyDialog faultId={f.id} />)}>
                <Send size={17} />
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
            {err && <Notice error>{err}</Notice>}
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
                  {!["skipped_no_recipient", "sent", "sending"].includes(
                    n.state,
                  ) && (
                    <Button
                      onClick={async () => {
                        try {
                          await run({ type: "notification.retry", id: n.id });
                          setErr("");
                        } catch (e) {
                          setErr(
                            e instanceof Error ? e.message : "Operace selhala.",
                          );
                        }
                      }}
                    >
                      Obnovit příjemce
                    </Button>
                  )}
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
