import { useState } from "react";
import { Link, useParams } from "react-router";
import { Plus, Upload, FileText, Pencil } from "lucide-react";
import { useFleet } from "../app/context";
import {
  Back,
  Badge,
  Button,
  ChoiceButton,
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
import { FuelIntakeDialog } from "./fuel-intake";
import { ReportsPage } from "./reports";
export function CostsPage() {
  const { tab = "overview" } = useParams();
  const { s, show } = useFleet(),
    edit = useEditors(),
    upload = useUpload();
  const tableActions =
    tab === "fuel" ? (
      <ChoiceButton
        label="Zadat tankování"
        icon={<Plus size={17} />}
        choices={[
          { label: "Manuálně", action: () => edit("fuels") },
          {
            label: "Nahrát účtenku",
            action: () => show(<FuelIntakeDialog />),
          },
        ]}
      />
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
    ) : null;
  return (
    <>
      <PageHead
        title="Náklady a CCS"
        subtitle="Doložené výdaje, tankování a souvislosti CCS podkladů."
      />
      <div className="panel">
        <Tabs
          base="/costs"
          selected={tab}
          items={[
            ["overview", "Přehled nákladů"],
            ["fuel", "Tankování"],
            ["statements", "CCS výpisy"],
            ["expenses", "Ostatní výdaje"],
          ]}
        />
        <div className="detail-body">
          {tab === "fuel" && (
            <>
              <FuelTable rows={s.fuels} toolbarActions={tableActions} />
            </>
          )}
          {tab === "statements" && (
            <>
              <DataTable
                toolbarActions={tableActions}
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
              toolbarActions={tableActions}
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
  const differences = transactions.filter(
    (t) =>
      t.state !== "Vyřešeno" &&
      (t.currency !== f.currency ||
        t.amountMinor !== f.amountMinor ||
        t.litres !== f.litres ||
        Date.parse(t.at) !== Date.parse(f.at) ||
        (t.cardId && t.cardId !== f.cardId) ||
        (t.vehicleId && t.vehicleId !== f.vehicleId)),
  );
  return (
    <>
      <Back to={actor.role === "Řidič" ? "/my/fuel" : "/costs/fuel"}>
        Tankování
      </Back>
      <PageHead
        title="Detail tankování"
        subtitle={date(f.at, true)}
        actions={
          <Button onClick={() => edit("fuels", f)}>
            Doplnit / opravit záznam
          </Button>
        }
      />
      <Panel title="Záznam řidiče">
        <Badge value={f.state} />
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
      </Panel>
      {actor.role !== "Řidič" && (
        <Panel title="Srovnání s CCS">
          {transactions.length ? (
            transactions.map((t) => (
              <div className="subform" key={t.id}>
                <DataGrid
                  items={[
                    ["CCS částka", money(t.amountMinor, t.currency)],
                    ["CCS litry", number(t.litres, "l")],
                    ["CCS datum", date(t.at, true)],
                    [
                      "Rozdíl",
                      t.currency !== f.currency || f.amountMinor === null
                        ? "Nelze vyhodnotit"
                        : money(t.amountMinor - f.amountMinor, t.currency),
                    ],
                    ["Výsledek", t.resolution || null],
                  ]}
                />
                <Badge value={t.state} />{" "}
                <Link to={`/transactions/${t.id}`}>Detail transakce →</Link>
              </div>
            ))
          ) : (
            <p className="muted">Záznam zatím není spojen s výpisem.</p>
          )}
          {!!differences.length && (
            <Button
              primary
              onClick={() =>
                show(
                  <ResolveDialog
                    transactionId={differences[0].id}
                    transactionIds={differences.map((t) => t.id)}
                    initialFuelId={f.id}
                  />,
                )
              }
            >
              Vyřešit CCS rozdíl
            </Button>
          )}
          {!transactions.length &&
            s.transactions
              .filter((t) => !t.fuelId && t.currency === f.currency)
              .map((t) => (
                <p key={t.id}>
                  <Link to={`/transactions/${t.id}`}>
                    {date(t.at, true)} · {money(t.amountMinor, t.currency)}
                  </Link>
                </p>
              ))}
        </Panel>
      )}
      <Panel title="Dokumenty">
        <DocumentList
          ownerType="fuel"
          ownerId={f.id}
          vehicleId={f.vehicleId}
          relatedOwners={
            actor.role !== "Řidič"
              ? transactions.map((t) => ({
                  ownerType: "statement" as const,
                  ownerId: t.statementId,
                }))
              : []
          }
        />
      </Panel>
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
            <Link
              className="btn"
              key={d.id}
              to={`/documents/${d.id}`}
              title={d.name}
            >
              <FileText size={17} />
              Zobrazit výpis (PDF)
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
  transactionIds,
}: {
  transactionId: string;
  initialFuelId?: string;
  transactionIds?: string[];
}) {
  const { s, run, close } = useFleet();
  const [selectedId, setSelectedId] = useState(transactionId);
  const t = s.transactions.find((x) => x.id === selectedId)!;
  return (
    <Dialog title="Vyřešit CCS rozdíl" onClose={close}>
      <div className="dialog-body">
        {transactionIds && transactionIds.length > 1 && (
          <label>
            CCS transakce
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {transactionIds.map((id) => (
                <option key={id} value={id}>
                  {s.transactions.find((x) => x.id === id)?.externalId}
                </option>
              ))}
            </select>
          </label>
        )}
        <Notice>
          Vyberte jednoznačný podklad a částku, která bude jediným kanonickým
          nákladem. Samotná účtenka se znovu nepřičte.
        </Notice>
        <Form
          key={t.id}
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
          <Button onClick={() => edit("expenses", e)}>
            <Pencil size={17} />
            Upravit
          </Button>
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
