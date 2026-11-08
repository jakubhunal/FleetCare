import { documentTarget, documentParent } from "../lib/navigation";
import { StatusChip } from "../components/status-chip";
import { useHistory } from "../lib/history";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation, useNavigate } from "react-router";
import { Upload, Download, Trash2, Pencil } from "lucide-react";
import { useFleet } from "../app/context";
import type { Document } from "../domain/models";
import {
  Back,
  Button,
  DataGrid,
  DataTable,
  Dialog,
  DeleteConfirmation,
  Empty,
  Form,
  HistorySwitch,
  Field,
  FilePicker,
  ValidatedForm,
  Notice,
  PageHead,
} from "../components/ui";
import { date, number } from "../lib/format";
import { fileLimits } from "../data/uploads";
import { documentDateField } from "../lib/form-validation";
const types: Record<Document["ownerType"], Document["type"][]> = {
  vehicle: ["STK", "Pojištění", "Servisní doklad", "Příloha"],
  driver: ["Řidičský průkaz", "Pracovní smlouva"],
  order: ["Dodací list"],
  fault: ["Servisní doklad"],
  fuel: ["Účtenka"],
  statement: ["CCS výpis"],
  intake: ["STK"],
  expense: ["Příloha", "Servisní doklad"],
};
export function UploadDialog({
  ownerType,
  ownerId,
  vehicleId,
  type,
  onUploaded,
}: {
  ownerType: Document["ownerType"];
  ownerId: string;
  vehicleId?: string;
  type?: Document["type"];
  onUploaded?: (result: { validUntil: string | null }) => void;
}) {
  const { upload, close } = useFleet();
  const [selected, setSelected] = useState<File[]>([]),
    [docType, setDocType] = useState(type || types[ownerType][0]),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [validUntil, setValid] = useState(""),
    [dueAt, setDue] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const dateField = documentDateField(docType);
  return (
    <Dialog
      title={type === "STK" ? "Nahrát STK" : "Přidat dokument"}
      onClose={close}
      dirty={!!selected.length}
    >
      <div className="dialog-body">
        <ValidatedForm
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending) return;
            setPending(true);
            setError("");
            try {
              await upload({
                ownerType,
                ownerId,
                vehicleId,
                type: docType,
                files: selected,
                validUntil:
                  dateField.key === "validUntil" ? validUntil || null : null,
                dueAt: dateField.key === "dueAt" ? dueAt || null : null,
                idempotencyKey: key,
              });
              if (onUploaded)
                onUploaded({
                  validUntil:
                    dateField.key === "validUntil" ? validUntil || null : null,
                });
              else close();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Uložení selhalo.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="form-grid">
            {type !== "STK" && (
              <Field>
                Typ dokumentu
                <select
                  value={docType}
                  onChange={(e) =>
                    setDocType(e.target.value as Document["type"])
                  }
                >
                  {types[ownerType].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field>
              {dateField.label}
              <input
                type="date"
                name={dateField.key}
                value={dateField.key === "validUntil" ? validUntil : dueAt}
                onChange={(e) =>
                  (dateField.key === "validUntil" ? setValid : setDue)(
                    e.target.value,
                  )
                }
              />
            </Field>
          </div>
          <FilePicker
            maxBytes={
              ["STK", "Řidičský průkaz", "Účtenka", "CCS výpis"].includes(
                docType,
              )
                ? fileLimits.extractionBytes
                : fileLimits.storageBytes
            }
            accept={docType === "CCS výpis" ? "application/pdf" : undefined}
            files={selected}
            error={error}
            onChange={setSelected}
            label="Vybrat soubory"
            camera={docType === "Účtenka"}
          />
          <small>Až {fileLimits.maxFiles} souborů. PDF, JPG nebo PNG.</small>
          <div className="form-actions">
            <Button
              primary
              type="submit"
              disabled={pending || !selected.length}
            >
              {pending ? "Ukládání…" : "Uložit dokumenty"}
            </Button>
          </div>
        </ValidatedForm>
      </div>
    </Dialog>
  );
}
export function useUpload() {
  const { show } = useFleet();
  return (
    ownerType: Document["ownerType"],
    ownerId: string,
    vehicleId?: string,
    type?: Document["type"],
    onUploaded?: (result: { validUntil: string | null }) => void,
  ) =>
    show(
      <UploadDialog
        ownerType={ownerType}
        ownerId={ownerId}
        vehicleId={vehicleId}
        type={type}
        onUploaded={onUploaded}
      />,
    );
}
export function DocumentLink(props: React.ComponentProps<typeof Link>) {
  const location = useLocation();
  return (
    <Link
      {...props}
      to={
        typeof props.to === "string"
          ? documentTarget(props.to, location.pathname + location.search)
          : props.to
      }
      state={{
        returnTo: location.pathname + location.search,
        returnLabel:
          document.querySelector("h1")?.textContent || "Předchozí stránka",
        parentState: location.state,
      }}
    />
  );
}
export function DocumentList({
  ownerType,
  ownerId,
  vehicleId,
  add = true,
  relatedOwners = [],
}: {
  ownerType: Document["ownerType"];
  ownerId: string;
  vehicleId?: string;
  add?: boolean;
  relatedOwners?: { ownerType: Document["ownerType"]; ownerId: string }[];
}) {
  const { s, show, close, run } = useFleet(),
    open = useUpload();
  const prefix = `documents-${ownerType}-${ownerId}.`;
  const {
    rows: docs,
    historical,
    setHistorical,
  } = useHistory(
    s.documents.filter(
      (d) =>
        !d.deletedAt &&
        ((d.ownerType === ownerType && d.ownerId === ownerId) ||
          (ownerType === "vehicle" && d.vehicleId === ownerId) ||
          relatedOwners.some(
            (o) => o.ownerType === d.ownerType && o.ownerId === d.ownerId,
          )),
    ),
    (d) =>
      !!d.validUntil && d.validUntil < new Date().toISOString().slice(0, 10),
    prefix,
  );
  return (
    <>
      <DataTable
        toolbarActions={
          <>
            {add && (
              <Button
                primary
                onClick={() => open(ownerType, ownerId, vehicleId)}
              >
                <Upload size={17} />
                Přidat dokument
              </Button>
            )}
            <HistorySwitch checked={historical} onChange={setHistorical} />
          </>
        }
        prefix={prefix}
        rows={docs}
        path={(d) => `/documents/${d.id}`}
        search={(d) => d.name + " " + d.type}
        filters={[
          {
            key: "type",
            label: "Všechny typy dokumentů",
            options: Array.from(new Set(docs.map((d) => d.type))).map(
              (type) => [type, type],
            ),
            value: (d) => d.type,
          },
        ]}
        columns={[
          {
            key: "name",
            label: "Dokument",
            sort: (d) => d.name,
            render: (d) => (
              <>
                <strong>{d.name}</strong>
                <small>{d.type}</small>
              </>
            ),
          },
          {
            key: "date",
            label: "Datum / zdroj",
            sort: (d) => d.uploadedAt,
            render: (d) => (
              <>
                {date(d.uploadedAt)}
                <small>
                  {d.source === "manual" ? "Ruční nahrání" : d.source}
                </small>
              </>
            ),
          },
          {
            key: "valid",
            label: "Platnost / splatnost",
            sort: (d) => d.validUntil,
            render: (d) => (
              <>
                {date(d.validUntil)}
                <small>{d.dueAt ? "Splatnost " + date(d.dueAt) : ""}</small>
              </>
            ),
          },
          {
            key: "state",
            label: "Uložení / zpracování",
            render: (d) => (
              <>
                <StatusChip entity="file" value={d.fileState} />
                <small>
                  <StatusChip entity="processing" value={d.extraction} />
                </small>
              </>
            ),
          },
          ...(ownerType === "driver"
            ? [
                {
                  key: "delete",
                  label: "Akce",
                  render: (d: Document) => (
                    <Button
                      danger
                      aria-label={`Smazat ${d.name}`}
                      onClick={() =>
                        show(
                          <DeleteConfirmation
                            title="Smazat dokument?"
                            irreversible
                            description={`Smazat soubor „${d.name}“? Profil a dříve uložená oprávnění zůstanou zachována.`}
                            onDone={close}
                            action={() =>
                              run({ type: "document.delete", id: d.id })
                            }
                          />,
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
export function DocumentPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { s, actor, repo, show, close, run } = useFleet();
  const doc = s.documents.find((d) => d.id === id && !d.deletedAt);
  const client = useQueryClient();
  const fallback = doc
    ? {
        vehicle: `/vehicles/${doc.ownerId}/documents`,
        driver:
          actor.role === "Řidič"
            ? "/my/documents"
            : `/drivers/${doc.ownerId}/documents`,
        order: `/orders/${doc.ownerId}`,
        expense: `/expenses/${doc.ownerId}`,
        fuel: `/fuels/${doc.ownerId}`,
        fault: `/faults/${doc.ownerId}`,
        statement: `/statements/${doc.ownerId}`,
        intake: "/vehicles",
      }[doc.ownerType]
    : "/";
  const returnTo = documentParent(location.search, fallback);
  // Capture the destination before the successful delete removes the document.
  const deleteTarget =
    doc?.ownerType === "vehicle"
      ? `/vehicles/${doc.vehicleId || doc.ownerId}/documents`
      : /^\/documents(?:\/|[?#]|$)/.test(returnTo)
        ? fallback
        : returnTo;
  const labels: Record<string, string> = {
    vehicles: "Vozidla",
    drivers: "Řidiči",
    orders: "Zakázky",
    expenses: "Výdaje",
    fuels: "Tankování",
    faults: "Závady",
    statements: "CCS výpisy",
    overview: "Přehled",
    transactions: "CCS transakce",
    my: "Moje dokumenty",
    costs: "Náklady a CCS",
  };
  const parts = returnTo.split("?")[0].split("/");
  const previousName =
    parts[1] === "vehicles"
      ? s.vehicles.find((v) => v.id === parts[2])?.spz
      : parts[1] === "drivers"
        ? s.drivers.find((d) => d.id === parts[2])?.name
        : parts[1] === "expenses"
          ? s.expenses.find((e) => e.id === parts[2])?.description
          : parts[1] === "orders"
            ? s.orders.find((o) => o.id === parts[2])?.number
            : parts[1] === "statements"
              ? s.statements.find((x) => x.id === parts[2])?.name
              : undefined;
  const back = (
    <Back
      to={returnTo}
      returnState={
        location.state?.parentState || {
          tableQueries: location.state?.tableQueries,
        }
      }
    >
      {parts[1] === "vehicles" && parts[2]
        ? "Detail vozidla"
        : previousName || labels[parts[1]] || "Přehled"}
    </Back>
  );
  const job = useQuery({
    queryKey: ["job", repo.mode, actor.role, actor.driverId, doc?.jobId],
    queryFn: ({ signal }) => repo.job(actor, doc!.jobId!, signal),
    enabled: !!doc?.jobId && ["queued", "processing"].includes(doc.extraction),
    retry: false,
    refetchInterval: (query) =>
      query.state.data &&
      ["queued", "processing"].includes(query.state.data.state) &&
      query.state.dataUpdateCount < 6
        ? [2000, 5000, 10000, 20000, 30000][
            Math.min(4, query.state.dataUpdateCount)
          ]
        : false,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    if (job.data && !["queued", "processing"].includes(job.data.state))
      void client.invalidateQueries({ queryKey: ["workspace"] });
  }, [job.data, client]);
  const query = useQuery({
    queryKey: ["file", repo.mode, actor.role, actor.driverId, id],
    queryFn: ({ signal }) => repo.file(actor, id!, signal),
    enabled: !!doc,
    retry: false,
    gcTime: 0,
  });
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!query.data) return;
    const u = URL.createObjectURL(query.data);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [query.data]);
  if (!doc)
    return (
      <>
        {" "}
        {back}
        <Empty
          title="Dokument není dostupný"
          text="Záznam neexistuje nebo k němu nemáte oprávnění."
        />
      </>
    );
  return (
    <>
      {back}
      <PageHead
        title={doc.name}
        subtitle={doc.type + " · " + date(doc.uploadedAt)}
        actions={
          <>
            {(actor.role !== "Řidič" ||
              (doc.ownerType === "driver" &&
                doc.ownerId === actor.driverId)) && (
              <>
                <Button onClick={() => show(<EditDocument doc={doc} />)}>
                  <Pencil size={17} />
                  Upravit
                </Button>
                <Button
                  danger
                  onClick={() =>
                    show(
                      <DeleteConfirmation
                        title="Smazat dokument?"
                        irreversible
                        description={`Opravdu smazat dokument „${doc.name}“?`}
                        onDone={close}
                        action={async () => {
                          await run({ type: "document.delete", id: doc.id });
                          navigate(deleteTarget, {
                            replace: true,
                            state: location.state?.parentState || {
                              tableQueries: location.state?.tableQueries,
                            },
                          });
                        }}
                      />,
                    )
                  }
                >
                  <Trash2 size={17} />
                  Smazat
                </Button>
              </>
            )}
            {url && (
              <a className="btn" href={url} download={doc.name}>
                <Download size={17} />
                Stáhnout
              </a>
            )}
          </>
        }
      />
      <div className="document-layout">
        <div className="document-view">
          {query.isPending ? (
            "Načítání originálu…"
          ) : query.error ? (
            <Notice error>
              {query.error.message}
              <Button onClick={() => void query.refetch()}>
                Obnovit přístup
              </Button>
            </Notice>
          ) : url ? (
            doc.mime === "application/pdf" ? (
              <iframe title={"Originál " + doc.name} src={url} />
            ) : (
              <img src={url} alt={"Originál dokumentu " + doc.name} />
            )
          ) : null}
        </div>
        <div className="panel panel-body">
          <h2>Údaje o souboru</h2>
          <DataGrid
            items={[
              ["Stav", <StatusChip entity="file" value={doc.fileState} />],
              [
                "Stav zpracování",
                <StatusChip entity="processing" value={doc.extraction} />,
              ],
            ]}
          />
          {job.error && (
            <Notice error>
              {job.error.message}
              <Button onClick={() => void job.refetch()}>
                Znovu zjistit stav
              </Button>
            </Notice>
          )}
          {job.data?.missingFields?.length && (
            <Notice error>
              Chybí údaje: {job.data.missingFields.join(", ")}
            </Notice>
          )}
          {doc.jobId && (
            <Button
              onClick={() => {
                void job.refetch();
                void client.invalidateQueries({ queryKey: ["workspace"] });
              }}
            >
              Obnovit stav zpracování
            </Button>
          )}
          {doc.error && <Notice error>{doc.error}</Notice>}
          <p>Velikost: {number(doc.size / 1024, "kB")}</p>
          <p>Platnost: {date(doc.validUntil)}</p>
          <p>Splatnost: {date(doc.dueAt)}</p>
          {doc.ownerType === "fuel" && (
            <Link to={`/fuels/${doc.ownerId}`}>Otevřít tankování →</Link>
          )}
          {doc.ownerType === "intake" && actor.role !== "Řidič" && (
            <>
              <p className="muted">
                STK pro nové vozidlo: originál čeká na připojené zpracování.
                Vozidlo můžete založit ručně a následně dokument připojit.
              </p>
              <Button onClick={() => show(<LinkDocument id={doc.id} />)}>
                Připojit k existujícímu vozidlu
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
function LinkDocument({ id }: { id: string }) {
  const { s, run, close } = useFleet();
  const [v, setV] = useState(""),
    [err, setErr] = useState("");
  return (
    <Dialog title="Připojit STK k vozidlu" onClose={close}>
      <div className="dialog-body">
        <Field>
          Vozidlo
          <select value={v} onChange={(e) => setV(e.target.value)}>
            <option value="">Vyberte…</option>
            {s.vehicles.map((x) => (
              <option key={x.id} value={x.id}>
                {x.spz}
              </option>
            ))}
          </select>
        </Field>
        {err && <Notice error>{err}</Notice>}
        <div className="form-actions">
          <Button
            primary
            disabled={!v}
            onClick={async () => {
              try {
                await run({ type: "document.link", id, vehicleId: v });
                close();
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Uložení selhalo.");
              }
            }}
          >
            Připojit dokument
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function EditDocument({ doc }: { doc: Document }) {
  const { run, close } = useFleet();
  const [dirty, setDirty] = useState(false);
  return (
    <Dialog title="Upravit dokument" onClose={close} dirty={dirty}>
      <div className="dialog-body">
        <Form
          fields={[
            { key: "name", label: "Název", required: true },
            { ...documentDateField(doc.type), type: "date" },
          ]}
          initial={doc}
          onDirty={setDirty}
          onSubmit={async (v) => {
            await run({
              type: "document.update",
              id: doc.id,
              version: doc.version,
              name: String(v.name),
              validUntil:
                documentDateField(doc.type).key === "validUntil"
                  ? String(v.validUntil) || null
                  : doc.validUntil,
              dueAt:
                documentDateField(doc.type).key === "dueAt"
                  ? String(v.dueAt) || null
                  : doc.dueAt,
            });
            close();
          }}
        />
      </div>
    </Dialog>
  );
}
