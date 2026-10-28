import { useState } from "react";
import { useSearchParams } from "react-router";
import { Download } from "lucide-react";
import { useFleet } from "../app/context";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  Empty,
  Notice,
  PageHead,
  Panel,
} from "../components/ui";
import { report, type Scope } from "../domain/analytics";
import { date, money, number, today } from "../lib/format";
import {
  buildPdf,
  buildXlsx,
  download,
  type ExportCell,
  type ExportData,
} from "../lib/export";
export function useScope() {
  const [params, setParams] = useSearchParams();
  const scope: Scope = {
    from: params.get("from") || today().slice(0, 7) + "-01",
    to: params.get("to") || today(),
    vehicleId: params.get("vehicle") || "",
    category: params.get("category") || "",
    currency: params.get("currency") || "CZK",
    costType: params.get("cost") || "all",
  };
  const change = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    p.set(key, value);
    setParams(p, { replace: true });
  };
  return { scope, change };
}
export function ScopeFilters({
  scope,
  change,
  costs = true,
}: {
  scope: Scope;
  change: (key: string, value: string) => void;
  costs?: boolean;
}) {
  const { s } = useFleet();
  return (
    <div className="report-filters">
      <label>
        Od
        <input
          type="date"
          value={scope.from}
          onChange={(e) => change("from", e.target.value)}
        />
      </label>
      <label>
        Do
        <input
          type="date"
          value={scope.to}
          onChange={(e) => change("to", e.target.value)}
        />
      </label>
      <label>
        Vozidlo
        <select
          value={scope.vehicleId}
          onChange={(e) => change("vehicle", e.target.value)}
        >
          <option value="">Všechna vozidla</option>
          {s.vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.spz}
            </option>
          ))}
        </select>
      </label>
      <label>
        Kategorie
        <select
          value={scope.category}
          onChange={(e) => change("category", e.target.value)}
        >
          <option value="">Všechny kategorie</option>
          {["Kamion", "Nákladní vozidlo", "Dodávka", "Osobní auto"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      {costs && (
        <>
          <label>
            Měna
            <select
              value={scope.currency}
              onChange={(e) => change("currency", e.target.value)}
            >
              {["CZK", "EUR"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Náklady
            <select
              value={scope.costType}
              onChange={(e) => change("cost", e.target.value)}
            >
              <option value="all">Všechny náklady</option>
              <option value="fuel">Pouze palivo</option>
              <option value="other">Bez paliva</option>
            </select>
          </label>
        </>
      )}
    </div>
  );
}
export function ReportsPage({ costsOnly = false }: { costsOnly?: boolean }) {
  const { s, actor, show } = useFleet();
  const { scope, change } = useScope();
  if (!costsOnly && actor.role !== "Vedení")
    return (
      <Empty
        title="Nedostatečná oprávnění"
        text="Reporty jsou dostupné pouze vedení."
      />
    );
  const result = report(s, scope);
  const categoryCosts = Array.from(
    new Set(result.costs.map((c) => c.category)),
  ).map((category) => ({
    category,
    total: result.costs
      .filter((c) => !c.provisional && c.category === category)
      .reduce((n, c) => n + c.amountMinor, 0),
  }));
  const max = Math.max(1, ...categoryCosts.map((c) => c.total));
  return (
    <>
      {!costsOnly && (
        <PageHead
          title="Reporty"
          subtitle="Provozní podklady a měsíční manažerský přehled."
          actions={
            <Button
              primary
              onClick={() =>
                show(<ExportDialog kind="report" initialScope={scope} />)
              }
            >
              <Download size={17} />
              Export měsíčního reportu
            </Button>
          }
        />
      )}
      <ScopeFilters scope={scope} change={change} />
      {scope.to < scope.from && (
        <Notice error>Konec období předchází začátku.</Notice>
      )}
      <div className="kpi-grid">
        <Kpi
          label="Doložené náklady vč. DPH"
          value={money(result.actualMinor, scope.currency)}
          hint="Kanonické náklady bez duplicit"
        />
        <Kpi
          label="Předběžné náklady"
          value={money(result.provisionalMinor, scope.currency)}
          hint="Nevyřešené CCS podklady"
        />
        <Kpi
          label="Doložené kilometry"
          value={number(result.km, "km")}
          hint={`${result.rows.reduce((n, r) => n + r.missing, 0)} jízd bez koncového tachometru`}
        />
        {!costsOnly && (
          <Kpi
            label="Uskutečněné výnosy bez DPH"
            value={money(result.revenueMinor, scope.currency)}
            hint={
              "Plánované " + money(result.plannedRevenueMinor, scope.currency)
            }
          />
        )}
      </div>
      <div className="two-columns">
        <Panel title="Náklady podle kategorie">
          {categoryCosts.length ? (
            categoryCosts.map((c) => (
              <div className="bar-row" key={c.category}>
                <span>{c.category}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: (Math.max(0, c.total) / max) * 100 + "%" }}
                  />
                </div>
                <strong>{money(c.total, scope.currency)}</strong>
              </div>
            ))
          ) : (
            <Empty
              title="Žádné doložené náklady"
              text="Pro vybrané období a měnu nejsou podklady."
            />
          )}
        </Panel>
        <Panel title="Úplnost a metodika">
          <p>
            Období {date(scope.from)} — {date(scope.to)}. Měny se vyhodnocují
            odděleně.
          </p>
          <p>
            Náklady obsahují částky včetně DPH. Cena zakázky je bez DPH. Odhady
            oprav se nezapočítávají.
          </p>
          <p>
            Spotřeba vychází pouze z doloženého úseku mezi tankováními do plna v
            období, včetně dílčích tankování.
          </p>
          <p>
            Využití vozidel: <strong>Nelze vyhodnotit</strong> — není definován
            dostupný pracovní čas.
          </p>
        </Panel>
      </div>
      <Panel title="Podklady podle vozidel">
        <DataTable
          prefix="report."
          rows={result.rows.map((r) => ({ ...r, id: r.vehicleId }))}
          search={(r) => r.spz}
          path={(r) => `/vehicles/${r.vehicleId}`}
          columns={[
            {
              key: "spz",
              label: "Vozidlo",
              sort: (r) => r.spz,
              render: (r) => r.spz,
            },
            {
              key: "km",
              label: "Doložené km",
              sort: (r) => r.km,
              render: (r) => (
                <>
                  {number(r.km, "km")}
                  <small>
                    {r.missing ? `${r.missing} neúplných jízd` : ""}
                  </small>
                </>
              ),
            },
            {
              key: "litres",
              label: "Palivo",
              sort: (r) => r.litres,
              render: (r) => number(r.litres, "l"),
            },
            {
              key: "consumption",
              label: "Doložená spotřeba",
              render: (r) =>
                r.consumption === null
                  ? "Nelze vyhodnotit"
                  : number(r.consumption, "l/100 km"),
            },
            {
              key: "cost",
              label: "Doložené náklady",
              sort: (r) => r.actualMinor,
              render: (r) => money(r.actualMinor, scope.currency),
            },
            {
              key: "perkm",
              label: "Náklady/km",
              render: (r) =>
                r.costPerKm === null
                  ? "Nelze vyhodnotit"
                  : money(Math.round(r.costPerKm), scope.currency),
            },
            {
              key: "fuelkm",
              label: "Palivo/km",
              render: (r) =>
                r.fuelPerKm === null
                  ? "Nelze vyhodnotit"
                  : money(Math.round(r.fuelPerKm), scope.currency),
            },
            ...(!costsOnly
              ? [
                  {
                    key: "revenue",
                    label: "Uskutečněné výnosy",
                    render: (r: (typeof result.rows)[number]) =>
                      money(r.revenueMinor, scope.currency),
                  },
                  {
                    key: "faults",
                    label: "Závady",
                    render: (r: (typeof result.rows)[number]) => r.faults,
                  },
                ]
              : []),
          ]}
        />
      </Panel>
      {!costsOnly && (
        <Notice>
          Rozdíl výnosů a vybraných provozních nákladů není čistý zisk.
          Nezahrnuje úplné účetní náklady firmy.
        </Notice>
      )}
    </>
  );
}
export function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">
        {label}
        <span className="kpi-dot" />
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}
const tripColumns = [
  ["date", "Datum"],
  ["vehicle", "Vozidlo"],
  ["driver", "Řidič"],
  ["purpose", "Zakázka / účel"],
  ["start", "Začátek"],
  ["end", "Konec"],
  ["route", "Místa od–do"],
  ["startKm", "Počáteční km"],
  ["endKm", "Koncové km"],
  ["km", "Km"],
  ["state", "Stav"],
  ["source", "Zdroj"],
] as const;
export function ExportDialog({
  kind,
  initialScope,
}: {
  kind: "trips" | "report";
  initialScope?: Scope;
}) {
  const { s, actor, close } = useFleet();
  const [scope, setScope] = useState<Scope>(
    initialScope || {
      from: today().slice(0, 7) + "-01",
      to: today(),
      vehicleId: "",
      category: "",
      currency: "CZK",
      costType: "all",
    },
  );
  const [vehicles, setVehicles] = useState<string[]>([]),
    [driver, setDriver] = useState(""),
    [columns, setColumns] = useState<string[]>(tripColumns.map((c) => c[0])),
    [format, setFormat] = useState("pdf"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const isReport = kind === "report";
  const change = (key: string, value: string) =>
    setScope((x) => ({
      ...x,
      [({ vehicle: "vehicleId", cost: "costType" } as Record<string, string>)[
        key
      ] || key]: value,
    }));
  return (
    <Dialog
      title={isReport ? "Export měsíčního reportu" : "Export knihy jízd"}
      onClose={close}
    >
      <div className="dialog-body">
        <ScopeFilters scope={scope} change={change} costs={isReport} />
        {!isReport && (
          <>
            <label>
              Řidič
              <select
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
              >
                <option value="">Všichni dostupní řidiči</option>
                {s.drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>
                Více vozidel (prázdný výběr zahrne všechna dostupná)
              </legend>
              {s.vehicles.map((v) => (
                <label className="check-option" key={v.id}>
                  <input
                    type="checkbox"
                    checked={vehicles.includes(v.id)}
                    onChange={(e) =>
                      setVehicles(
                        e.target.checked
                          ? [...vehicles, v.id]
                          : vehicles.filter((id) => id !== v.id),
                      )
                    }
                  />
                  {v.spz}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Sloupce exportu</legend>
              {tripColumns.map(([id, label]) => (
                <label key={id} className="check-option">
                  <input
                    type="checkbox"
                    checked={columns.includes(id)}
                    onChange={(e) =>
                      setColumns(
                        e.target.checked
                          ? [...columns, id]
                          : columns.filter((c) => c !== id),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          </>
        )}
        <label>
          Formát
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="pdf">PDF pro čtení / tisk</option>
            <option value="xlsx">XLSX pro Excel</option>
          </select>
        </label>
        {error && <Notice error>{error}</Notice>}
        <div className="form-actions">
          <Button
            primary
            disabled={busy || !columns.length}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                if (scope.from > scope.to) throw new Error("Opravte období.");
                if (isReport && actor.role !== "Vedení")
                  throw new Error("Report smí exportovat pouze vedení.");
                let data: ExportData;
                if (isReport) {
                  const r = report(s, scope);
                  data = {
                    title: "FleetCare · měsíční manažerský report",
                    subtitle: `${date(scope.from)} — ${date(scope.to)} · ${scope.currency}`,
                    columns: [
                      "Vozidlo",
                      "Doložené km",
                      "Palivo (l)",
                      "Spotřeba (l/100 km)",
                      "Náklady vč. DPH",
                      "Předběžné náklady",
                      "Výnosy bez DPH",
                      "Plánované výnosy",
                    ],
                    rows: r.rows.map((row) => [
                      row.spz,
                      row.km,
                      row.litres,
                      row.consumption,
                      row.actualMinor / 100,
                      row.provisionalMinor / 100,
                      row.revenueMinor / 100,
                      row.plannedRevenueMinor / 100,
                    ]),
                    footer: `Doložené náklady ${money(r.actualMinor, scope.currency)}. Účtenka a CCS jsou jeden náklad. Odhady vyloučeny. Náklady/km jen z doložených km téhož období. Nejde o čistý zisk. Chybějící spotřeba = nedostatek úplných úseků.`,
                  };
                } else {
                  const rows = s.trips.filter(
                    (t) =>
                      t.startAt.slice(0, 10) >= scope.from &&
                      t.startAt.slice(0, 10) <= scope.to &&
                      (!scope.vehicleId || t.vehicleId === scope.vehicleId) &&
                      (!vehicles.length || vehicles.includes(t.vehicleId)) &&
                      (!driver || t.driverId === driver) &&
                      (!scope.category ||
                        s.vehicles.find((v) => v.id === t.vehicleId)
                          ?.category === scope.category),
                  );
                  const defs = tripColumns.filter((c) =>
                    columns.includes(c[0]),
                  );
                  data = {
                    title: "FleetCare · kniha jízd",
                    subtitle: `${date(scope.from)} — ${date(scope.to)} · ${
                      s.vehicles
                        .filter(
                          (v) =>
                            (!scope.vehicleId || v.id === scope.vehicleId) &&
                            (!vehicles.length || vehicles.includes(v.id)),
                        )
                        .map((v) => v.spz)
                        .join(", ") || "Žádná vozidla"
                    }`,
                    columns: defs.map((c) => c[1]),
                    rows: rows.map((t) => {
                      const values: Record<string, ExportCell> = {
                        date: new Date(t.startAt),
                        vehicle:
                          s.vehicles.find((v) => v.id === t.vehicleId)?.spz ||
                          "",
                        driver:
                          s.drivers.find((d) => d.id === t.driverId)?.name ||
                          "",
                        purpose: t.orderId
                          ? s.orders.find((o) => o.id === t.orderId)?.number ||
                            ""
                          : t.purpose,
                        start: new Date(t.startAt),
                        end: t.endAt ? new Date(t.endAt) : null,
                        route: t.from + " → " + t.to,
                        startKm: t.startKm,
                        endKm: t.endKm,
                        km: t.endKm === null ? null : t.endKm - t.startKm,
                        state: t.state,
                        source: t.source,
                      };
                      return defs.map(([key]) => values[key]);
                    }),
                    footer: `Součet doložených km: ${number(
                      rows.reduce(
                        (n, t) =>
                          n + (t.endKm === null ? 0 : t.endKm - t.startKm),
                        0,
                      ),
                      "km",
                    )}. Chybějící koncový tachometr: ${rows.filter((t) => t.endKm === null).length} jízd. Chybějící km nejsou nula.`,
                  };
                }
                const blob =
                  format === "pdf"
                    ? await buildPdf(data)
                    : await buildXlsx(data);
                download(
                  blob,
                  `FleetCare-${isReport ? "report" : "kniha-jizd"}-${scope.from}.${format}`,
                );
                close();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Export selhal.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Připravuji soubor…" : "Stáhnout " + format.toUpperCase()}
          </Button>
        </div>
        <p className="muted">
          Export zahrnuje celý filtrovaný výběr, včetně dalších stránek.
        </p>
        <Badge value="Lokálně vytvořený soubor" />
      </div>
    </Dialog>
  );
}
