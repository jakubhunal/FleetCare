import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { Upload, Download, Trash2, Pencil } from "lucide-react";
import { useFleet, Confirm } from "../app/context";
import type { Document } from "../domain/models";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
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
}: {
  ownerType: Document["ownerType"];
  ownerId: string;
  vehicleId?: string;
  type?: Document["type"];
}) {
  const { upload, close } = useFleet();
  const [selected, setSelected] = useState<File[]>([]),
    [docType, setDocType] = useState(type || types[ownerType][0]),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [validUntil, setValid] = useState(""),
    [dueAt, setDue] = useState("");
  const [key] = useState(() => crypto.randomUUID());
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
                validUntil: validUntil || null,
                dueAt: dueAt || null,
                idempotencyKey: key,
              });
              close();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Uložení selhalo.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="form-grid">
            <Field>
              Typ dokumentu
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as Document["type"])}
              >
                {types[ownerType].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field>
              Platnost do (metadata)
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValid(e.target.value)}
              />
            </Field>
            <Field>
              Splatnost (metadata)
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDue(e.target.value)}
              />
            </Field>
          </div>
          <FilePicker
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
  ) =>
    show(
      <UploadDialog
        ownerType={ownerType}
        ownerId={ownerId}
        vehicleId={vehicleId}
        type={type}
      />,
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
  const [historical, setHistorical] = useState(false);
  const docs = s.documents.filter(
    (d) =>
      !d.deletedAt &&
      ((d.ownerType === ownerType && d.ownerId === ownerId) ||
        (ownerType === "vehicle" && d.vehicleId === ownerId) ||
        relatedOwners.some(
          (o) => o.ownerType === d.ownerType && o.ownerId === d.ownerId,
        )) &&
      (historical ||
        !d.validUntil ||
        d.validUntil >= new Date().toISOString().slice(0, 10)),
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
        prefix={`documents-${ownerType}-${ownerId}.`}
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
                <Badge value={d.fileState} />
                <small>
                  <Badge value={d.extraction} />
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
                          <Confirm
                            title="Smazat dokument"
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
  const { s, actor, repo, show, close, run } = useFleet();
  const doc = s.documents.find((d) => d.id === id && !d.deletedAt);
  const client = useQueryClient();
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
      <Empty
        title="Dokument není dostupný"
        text="Záznam neexistuje nebo k němu nemáte oprávnění."
      />
    );
  return (
    <>
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
                      <Confirm
                        title="Smazat dokument"
                        description={`Opravdu smazat dokument „${doc.name}“?`}
                        onDone={close}
                        action={() =>
                          run({ type: "document.delete", id: doc.id })
                        }
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
          <p>
            <Badge value={doc.fileState} />
          </p>
          <p>
            <Badge value={doc.extraction} />
          </p>
          {job.error && (
            <Notice error>
              {job.error.message}
              <Button onClick={() => void job.refetch()}>
                Znovu zjistit stav
              </Button>
            </Notice>
          )}
          {job.data?.missingFields?.length && (
            <Notice>Chybí údaje: {job.data.missingFields.join(", ")}</Notice>
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
          {doc.extraction === "not_configured" && (
            <Notice>
              Soubor je uložen. Extrakční služba není připojena; žádné údaje
              nebyly automaticky načteny.
            </Notice>
          )}
          <p>Velikost: {number(doc.size / 1024, "kB")}</p>
          <p>Platnost: {date(doc.validUntil)}</p>
          <p>Splatnost: {date(doc.dueAt)}</p>
          {doc.ownerType === "fuel" && (
            <Link to={`/fuels/${doc.ownerId}`}>Otevřít tankování →</Link>
          )}
          {doc.ownerType === "intake" && actor.role !== "Řidič" && (
            <>
              <Notice>
                STK pro nové vozidlo: originál čeká na připojené zpracování.
                Vozidlo můžete založit ručně a následně dokument připojit.
              </Notice>
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
            { key: "validUntil", label: "Platnost do", type: "date" },
            { key: "dueAt", label: "Splatnost", type: "date" },
          ]}
          initial={doc}
          onDirty={setDirty}
          onSubmit={async (v) => {
            await run({
              type: "document.update",
              id: doc.id,
              version: doc.version,
              name: String(v.name),
              validUntil: String(v.validUntil) || null,
              dueAt: String(v.dueAt) || null,
            });
            close();
          }}
        />
      </div>
    </Dialog>
  );
}
