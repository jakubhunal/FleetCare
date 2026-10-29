import { Link, useParams } from "react-router";
import { Plus, Upload } from "lucide-react";
import { useFleet } from "../app/context";
import {
  Back,
  Badge,
  Button,
  DataGrid,
  DataTable,
  Dialog,
  Empty,
  Form,
  Notice,
  PageHead,
  Panel,
  Tabs,
} from "../components/ui";
import { useEditors } from "./editors";
import { DocumentList, useUpload } from "./documents";
import { DRef, FuelTable, VRef } from "./tables";
import { date, money, number } from "../lib/format";
import { ReportsPage } from "./reports";
export function CostsPage() {
  const { tab = "fuel" } = useParams();
  const { s } = useFleet(),
    edit = useEditors(),
    upload = useUpload();
  return (
    <>
      <PageHead
        title="Náklady a CCS"
        subtitle="Doložené výdaje, tankování a souvislosti CCS podkladů."
        actions={
          tab === "fuel" ? (
            <>
              <Button primary onClick={() => edit("fuels")}>
                <Plus size={17} />
                Zadat tankování
              </Button>
            </>
          ) : tab === "statements" ? (
            <Button
              primary
              onClick={() => upload("statement", "new", undefined, "CCS výpis")}
            >
              <Upload size={17} />
              Import CCS PDF
            </Button>
          ) : tab === "expenses" ? (
            <Button primary onClick={() => edit("expenses")}>
              <Plus size={17} />
              Nový výdaj
            </Button>
          ) : null
        }
      />
      <div className="panel">
        <Tabs
          base="/costs"
          selected={tab}
          items={[
            ["fuel", "Tankování"],
            ["statements", "CCS výpisy"],
            ["expenses", "Ostatní výdaje"],
            ["overview", "Přehled nákladů"],
          ]}
        />
        <div className="detail-body">
          {tab === "fuel" && (
            <>
              <Notice>
                Tankování lze uložit i s neúplnými údaji a přiložit účtenku v
                jeho detailu. Extrakce účtenek zatím není připojena.
              </Notice>
              <FuelTable rows={s.fuels} />
            </>
          )}
          {tab === "statements" && (
            <>
              <Notice>
                Výpisy přicházejí e-mailem. Ruční náhradní vstup uloží
                originální PDF. Datum přijetí a datum transakcí se evidují
                odděleně.
              </Notice>
              <DataTable
                rows={s.statements}
                path={(x) => `/statements/${x.id}`}
                search={(x) => x.name}
                columns={[
                  {
                    key: "name",
                    label: "Výpis",
                    sort: (x) => x.name,
                    render: (x) => <strong>{x.name}</strong>,
                  },
                  {
                    key: "period",
                    label: "Období",
                    sort: (x) => x.periodFrom,
                    render: (x) =>
                      `${date(x.periodFrom)} — ${date(x.periodTo)}`,
                  },
                  {
                    key: "received",
                    label: "Datum přijetí / zdroj",
                    sort: (x) => x.receivedAt,
                    render: (x) => (
                      <>
                        {date(x.receivedAt, true)}
                        <small>
                          {x.source === "manual" ? "Ruční upload" : "E-mail"}
                        </small>
                      </>
                    ),
                  },
                  {
                    key: "state",
                    label: "Zpracování / úplnost",
                    sort: (x) => x.processing,
                    render: (x) => (
                      <>
                        <Badge value={x.processing} />
                        <small>
                          {x.complete ? "Úplný" : "Neúplný / nezpracovaný"}
                        </small>
                      </>
                    ),
                  },
                ]}
              />
            </>
          )}
          {tab === "expenses" && (
            <DataTable
              rows={s.expenses}
              path={(e) => `/expenses/${e.id}`}
              search={(e) => e.description + " " + e.category}
              columns={[
                {
                  key: "description",
                  label: "Výdaj / popis",
                  sort: (e) => e.description,
                  render: (e) => (
                    <>
                      <strong>{e.description}</strong>
                      <small>
                        {e.category} · {e.kind}
                      </small>
                    </>
                  ),
                },
                {
                  key: "vehicle",
                  label: "Vozidlo",
                  render: (e) => <VRef id={e.vehicleId} />,
                },
                {
                  key: "date",
                  label: "Datum / úhrada",
                  sort: (e) => e.date,
                  render: (e) => (
                    <>
                      {date(e.date)}
                      <small>
                        {e.paidAt
                          ? "Uhrazeno " + date(e.paidAt)
                          : "Úhrada není doložena"}
                      </small>
                    </>
                  ),
                },
                {
                  key: "amount",
                  label: "Částka vč. DPH",
                  sort: (e) => e.amountMinor,
                  render: (e) => money(e.amountMinor, e.currency),
                },
              ]}
            />
          )}
          {tab === "overview" && <ReportsPage costsOnly />}
        </div>
      </div>
    </>
  );
}
export function FuelPage() {
  const { id } = useParams();
  const { s, actor, show } = useFleet(),
    edit = useEditors();
  const f = s.fuels.find((f) => f.id === id);
  if (!f) return <Empty title="Tankování není dostupné" />;
  const transactions = s.transactions.filter((t) => t.fuelId === f.id);
  return (
    <>
      <Back to={actor.role === "Řidič" ? "/my/fuel" : "/costs/fuel"}>
        Tankování
      </Back>
      <PageHead
        title="Detail tankování"
        subtitle={date(f.at, true)}
        actions={
          <Button primary onClick={() => edit("fuels", f)}>
            Doplnit / opravit záznam
          </Button>
        }
      />
      <div className="two-columns">
        <Panel title="Záznam řidiče">
          <p>
            <Badge value={f.state} />
          </p>
          <DataGrid
            items={[
              ["Vozidlo", <VRef id={f.vehicleId} />],
              ["Řidič", <DRef id={f.driverId} />],
              ["Datum transakce", date(f.at, true)],
              ["Litry", number(f.litres, "l")],
              ["Částka včetně DPH", money(f.amountMinor, f.currency)],
              ["Palivo", f.fuel || null],
              ["Stanice", f.station || null],
              ["Tachometr", number(f.km, "km")],
              ["Plná nádrž", f.full],
              [
                "CCS karta",
                s.cards.find((c) => c.id === f.cardId)?.number ||
                  f.cardId ||
                  "Bez karty",
              ],
            ]}
          />
          <DocumentList
            ownerType="fuel"
            ownerId={f.id}
            vehicleId={f.vehicleId}
          />
        </Panel>
        {actor.role !== "Řidič" && (
          <Panel title="CCS podklady">
            {transactions.length ? (
              transactions.map((t) => (
                <div className="subform" key={t.id}>
                  <DataGrid
                    items={[
                      ["CCS částka", money(t.amountMinor, t.currency)],
                      [
                        "Rozdíl",
                        f.amountMinor === null
                          ? "Nelze vyhodnotit"
                          : money(t.amountMinor - f.amountMinor, t.currency),
                      ],
                      ["Transakce", date(t.at, true)],
                      ["Výsledek", t.resolution || null],
                    ]}
                  />
                  <p>
                    <Badge value={t.state} />
                  </p>
                  <Link className="btn" to={`/transactions/${t.id}`}>
                    Detail transakce a řešení →
                  </Link>
                  <DocumentList
                    ownerType="statement"
                    ownerId={t.statementId}
                    add={false}
                  />
                </div>
              ))
            ) : (
              <>
                <Notice>
                  Účtenka a CCS transakce tvoří jeden kanonický náklad. Záznam
                  zatím není spojen s výpisem.
                </Notice>
                {s.transactions
                  .filter(
                    (t) =>
                      t.currency === f.currency &&
                      (!t.fuelId || t.fuelId === f.id),
                  )
                  .map((t) => (
                    <div className="list-item" key={t.id}>
                      <Link to={`/transactions/${t.id}`}>
                        {date(t.at, true)} · {money(t.amountMinor, t.currency)}
                      </Link>
                      <Button
                        onClick={() =>
                          show(
                            <ResolveDialog
                              transactionId={t.id}
                              initialFuelId={f.id}
                            />,
                          )
                        }
                      >
                        Spojit a vyřešit
                      </Button>
                    </div>
                  ))}
              </>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}
export function StatementPage() {
  const { id } = useParams();
  const { s } = useFleet();
  const x = s.statements.find((x) => x.id === id);
  if (!x) return <Empty title="Výpis není dostupný" />;
  return (
    <>
      <Back to="/costs/statements">CCS výpisy</Back>
      <PageHead
        title={x.name}
        subtitle={"Přijato " + date(x.receivedAt, true)}
        actions={s.documents
          .filter(
            (d) =>
              d.ownerType === "statement" && d.ownerId === x.id && !d.deletedAt,
          )
          .map((d) => (
            <Link className="btn" key={d.id} to={`/documents/${d.id}`}>
              {d.name}
            </Link>
          ))}
      />
      <Panel title="Transakce výpisu">
        <TransactionTable statementId={x.id} />
      </Panel>
    </>
  );
}
function TransactionTable({ statementId }: { statementId: string }) {
  const { s } = useFleet();
  return (
    <DataTable
      rows={s.transactions.filter((t) => t.statementId === statementId)}
      path={(t) => `/transactions/${t.id}`}
      search={(t) => t.externalId + " " + t.state}
      filters={[
        {
          key: "state",
          label: "Všechny stavy",
          options: [
            "Čeká na výpis",
            "Spárováno",
            "Rozdíl",
            "Více kandidátů",
            "Chybí záznam řidiče",
            "Neúplný podklad",
            "Vyřešeno",
          ].map((x) => [x, x]),
          value: (t) => t.state,
        },
      ]}
      columns={[
        {
          key: "reference",
          label: "Transakce",
          sort: (t) => t.externalId,
          render: (t) => t.externalId,
        },
        {
          key: "date",
          label: "Datum transakce",
          sort: (t) => t.at,
          render: (t) => date(t.at, true),
        },
        {
          key: "amount",
          label: "CCS částka",
          sort: (t) => t.amountMinor,
          render: (t) => money(t.amountMinor, t.currency),
        },
        {
          key: "state",
          label: "Párování",
          sort: (t) => t.state,
          render: (t) => <Badge value={t.state} />,
        },
      ]}
    />
  );
}
export function TransactionPage() {
  const { id } = useParams();
  const { s, show } = useFleet();
  const t = s.transactions.find((t) => t.id === id);
  if (!t) return <Empty title="Transakce není dostupná" />;
  const f = s.fuels.find((f) => f.id === t.fuelId);
  return (
    <>
      <Back to={`/statements/${t.statementId}`}>CCS výpis</Back>
      <PageHead
        title={t.externalId}
        subtitle="Porovnání podkladů jednoho nákladu"
        actions={
          <Button
            primary
            onClick={() =>
              show(
                <ResolveDialog
                  transactionId={t.id}
                  initialFuelId={t.fuelId || undefined}
                />,
              )
            }
          >
            Vyřešit CCS rozdíl
          </Button>
        }
      />
      <div className="two-columns">
        <Panel title="CCS transakce">
          <p>
            <Badge value={t.state} />
          </p>
          <DataGrid
            items={[
              ["Částka vč. DPH", money(t.amountMinor, t.currency)],
              ["Datum transakce", date(t.at, true)],
              ["Litry", number(t.litres, "l")],
              [
                "Kanonická částka",
                money(t.resolvedMinor ?? t.amountMinor, t.currency),
              ],
              ["Odůvodnění", t.resolution || null],
            ]}
          />
          <DocumentList
            ownerType="statement"
            ownerId={t.statementId}
            add={false}
          />
        </Panel>
        <Panel title="Záznam řidiče">
          {f ? (
            <>
              <DataGrid
                items={[
                  ["Částka vč. DPH", money(f.amountMinor, f.currency)],
                  ["Litry", number(f.litres, "l")],
                  [
                    "Rozdíl",
                    f.amountMinor === null
                      ? "Nelze vyhodnotit"
                      : money(t.amountMinor - f.amountMinor, t.currency),
                  ],
                ]}
              />
              <DocumentList ownerType="fuel" ownerId={f.id} add={false} />
              <Link to={`/fuels/${f.id}`}>Otevřít tankování →</Link>
            </>
          ) : (
            <Notice>
              Chybí jednoznačně spojený záznam řidiče. Vyberte podklad při
              řešení, nebo případ ponechte otevřený.
            </Notice>
          )}
        </Panel>
      </div>
    </>
  );
}
function ResolveDialog({
  transactionId,
  initialFuelId,
}: {
  transactionId: string;
  initialFuelId?: string;
}) {
  const { s, run, close } = useFleet();
  const t = s.transactions.find((x) => x.id === transactionId)!;
  return (
    <Dialog title="Vyřešit CCS rozdíl" onClose={close}>
      <div className="dialog-body">
        <Notice>
          Vyberte jednoznačný podklad a částku, která bude jediným kanonickým
          nákladem. Samotná účtenka se znovu nepřičte.
        </Notice>
        <Form
          fields={[
            {
              key: "fuelId",
              label: "Záznam tankování",
              type: "select",
              options: s.fuels
                .filter((f) => f.currency === t.currency)
                .map((f) => [
                  f.id,
                  `${date(f.at, true)} · ${money(f.amountMinor, f.currency)}`,
                ]),
            },
            {
              key: "amountMinor",
              label: `Výsledná částka vč. DPH (${t.currency})`,
              type: "money",
              required: true,
            },
            {
              key: "reason",
              label: "Důvod a podklady rozhodnutí",
              type: "textarea",
              required: true,
            },
          ]}
          initial={{
            fuelId: initialFuelId || "",
            amountMinor: t.resolvedMinor ?? t.amountMinor,
          }}
          onSubmit={async (v) => {
            await run({
              type: "ccs.resolve",
              transactionId: t.id,
              version: t.version,
              fuelId: String(v.fuelId) || null,
              amountMinor: Number(v.amountMinor),
              reason: String(v.reason),
            });
            close();
          }}
        />
      </div>
    </Dialog>
  );
}
export function ExpensePage() {
  const { id } = useParams();
  const { s } = useFleet(),
    edit = useEditors();
  const e = s.expenses.find((x) => x.id === id);
  if (!e) return <Empty title="Výdaj není dostupný" />;
  return (
    <>
      <Back to="/costs/expenses">Ostatní výdaje</Back>
      <PageHead
        title={e.description}
        subtitle={`${e.category} · ${e.kind}`}
        actions={
          <Button onClick={() => edit("expenses", e)}>Upravit výdaj</Button>
        }
      />
      <Panel>
        <DataGrid
          items={[
            ["Vozidlo", <VRef id={e.vehicleId} />],
            ["Datum výdaje", date(e.date)],
            ["Částka vč. DPH", money(e.amountMinor, e.currency)],
            ["DPH", number(e.vat, "%")],
            ["Úhrada", date(e.paidAt)],
          ]}
        />
        {s.documents.some(
          (d) => d.ownerType === "expense" && d.ownerId === e.id,
        ) && (
          <DocumentList
            ownerType="expense"
            ownerId={e.id}
            vehicleId={e.vehicleId}
          />
        )}
      </Panel>
    </>
  );
}
