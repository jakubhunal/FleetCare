import { fileLimits, validateUpload } from "../data/uploads";
import { DomainError } from "../domain/rules";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useFleet } from "../app/context";
import {
  Dialog,
  FilePicker,
  Form,
  Notice,
  type FieldSpec,
} from "../components/ui";
import {
  date,
  localTime,
  money,
  normalize,
  number,
  toPragueTimestamp,
} from "../lib/format";
import type { Actor, Workspace } from "../domain/models";
import type { ReceiptRead } from "../domain/receipt-extract";

const plain = (v = "") => normalize(v).replace(/-/g, "");

/**
 * Form values read from a receipt plus a sentence saying what was filled in
 * and what the user still has to check. Only values that match the records
 * (vehicle, driver, card) are selected; anything else is left to the user.
 */
export function receiptPrefill(s: Workspace, actor: Actor, read: ReceiptRead) {
  const f = read.fields;
  const values: Record<string, unknown> = {};
  const extra: string[] = [];
  const todo: string[] = [];
  if (read.state === "not_configured")
    return {
      values,
      extra,
      notice:
        "Čtení účtenek není v tomto režimu připojené. Údaje vyplňte ručně.",
    };
  if (read.state === "failed")
    return {
      values,
      extra,
      notice: `Údaje z účtenky nešlo načíst. ${read.error} Účtenka se k tankování i tak uloží.`,
    };
  const found: string[] = [];
  const vehicle = s.vehicles.find(
    (v) =>
      (f.spz && plain(v.spz) === plain(f.spz)) ||
      (f.vin && v.vin && plain(v.vin) === plain(f.vin)),
  );
  if (vehicle) {
    values.vehicleId = vehicle.id;
    found.push(`vozidlo ${vehicle.spz}`);
  } else if (f.spz || f.vin)
    todo.push(
      actor.role === "Řidič"
        ? `Vozidlo ${f.spz || f.vin} z účtenky nemáte přidělené, vyberte vozidlo, se kterým jste tankovali.`
        : `Vozidlo ${f.spz || f.vin} z účtenky není v evidenci, vyberte ho.`,
    );
  if (actor.role !== "Řidič" && f.driverName) {
    const driver = s.drivers.find(
      (d) => normalize(d.name) === normalize(f.driverName),
    );
    if (driver) {
      values.driverId = driver.id;
      found.push(`řidič ${driver.name}`);
    } else
      todo.push(
        `Řidič „${f.driverName}“ z účtenky není v evidenci, vyberte ho.`,
      );
  }
  if (f.date && f.time) {
    values.at = `${f.date}T${f.time}`;
    found.push(`čas ${date(f.date)} ${f.time}`);
  } else if (f.date) values.at = "";
  if (f.litres !== undefined) {
    values.litres = String(f.litres).replace(".", ",");
    found.push(number(f.litres, "l"));
  }
  const currency = f.currency || "CZK";
  if (f.amountMinor !== undefined && f.vat !== "Bez DPH") {
    if (["CZK", "EUR"].includes(currency)) {
      // As typed by a user ("2240,16"); the form turns it into haléře.
      values.amountMinor = (f.amountMinor / 100).toFixed(2).replace(".", ",");
      found.push(money(f.amountMinor, currency));
      if (currency !== "CZK") {
        values.currency = currency;
        extra.push("currency");
      }
    } else
      todo.push(
        `Částka je v měně ${currency}, zadejte ji ručně v CZK nebo EUR.`,
      );
  }
  if (f.fuel) {
    values.fuel = f.fuel;
    extra.push("fuel");
  }
  if (f.km !== undefined) {
    values.km = f.km;
    extra.push("km");
  }
  if (f.station) {
    values.station = f.station;
    extra.push("station");
  }
  if (f.cardNumber && actor.role !== "Řidič") {
    const card = s.cards.find(
      (c) => c.active && plain(c.number) === plain(f.cardNumber),
    );
    if (card) {
      values.cardId = card.id;
      extra.push("cardId");
    } else
      todo.push(`Karta ${f.cardNumber} z účtenky není mezi aktivními kartami.`);
  }
  if (read.missingFields.length)
    todo.push(`Na účtence chybí: ${read.missingFields.join(", ")}.`);
  if (f.vat === "Bez DPH")
    todo.push("Částka na účtence je bez DPH, zadejte částku včetně DPH.");
  return {
    values,
    extra,
    notice: [
      found.length
        ? `Z účtenky jsme načetli: ${found.join(", ")}. Zkontrolujte údaje a uložte.`
        : "Z účtenky jsme nenačetli nic, co by šlo vyplnit.",
      ...todo,
    ].join(" "),
  };
}

export function FuelIntakeDialog({ vehicleId }: { vehicleId?: string }) {
  const { s, actor, repo, run, upload, close, toast } = useFleet(),
    navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]),
    [id] = useState(() => crypto.randomUUID()),
    [, setSaved] = useState(false);
  const [reading, setReading] = useState(false),
    [prefill, setPrefill] = useState<ReturnType<typeof receiptPrefill>>(),
    [typed, setTyped] = useState<Record<string, unknown>>({}),
    [formKey, setFormKey] = useState(0);
  const box = useRef<HTMLDivElement>(null),
    lastRead = useRef(0);
  const extraFields: Record<string, FieldSpec> = {
    currency: {
      key: "currency",
      label: "Měna",
      type: "select",
      required: true,
      options: [
        ["CZK", "CZK"],
        ["EUR", "EUR"],
      ],
    },
    fuel: { key: "fuel", label: "Palivo" },
    km: { key: "km", label: "Tachometr (km)", type: "number" },
    station: { key: "station", label: "Čerpací stanice" },
    cardId: {
      key: "cardId",
      label: "CCS karta",
      type: "select",
      options: s.cards.filter((c) => c.active).map((c) => [c.id, c.number]),
    },
  };
  const fields = [
    ...(
      [
        {
          key: "vehicleId",
          label: "Vozidlo",
          type: "select",
          required: true,
          options: s.vehicles.map((v) => [v.id, v.spz]),
        },
        {
          key: "driverId",
          label: "Řidič",
          type: "select",
          required: true,
          options: s.drivers.map((d) => [d.id, d.name]),
        },
        {
          key: "at",
          label: "Skutečný čas transakce",
          type: "datetime",
          required: true,
          initial: localTime(),
        },
        {
          key: "litres",
          label: "Litry (l)",
          type: "number",
          required: true,
        },
        {
          key: "amountMinor",
          label: "Částka včetně DPH",
          type: "money",
          required: true,
        },
      ] satisfies FieldSpec[]
    ).filter((f) => actor.role !== "Řidič" || f.key !== "driverId"),
    ...(prefill?.extra || []).map((key) => extraFields[key]),
  ];
  // Reads the first chosen file and fills the form from it. Values typed
  // before the file was chosen stay, unless the receipt states them.
  async function pick(next: File[]) {
    const first = next[0];
    const changed = first && first !== files[0];
    setFiles(next);
    if (!next.length) setPrefill(undefined);
    if (!changed) return;
    const form = box.current?.querySelector("form");
    const current = form
      ? Object.fromEntries(
          [...new FormData(form)].filter(
            ([k, v]) => typeof v === "string" && v !== "" && k !== "files",
          ),
        )
      : {};
    const ticket = ++lastRead.current;
    setReading(true);
    try {
      const read = await repo.readReceipt(actor, first);
      if (ticket !== lastRead.current) return;
      setTyped(current);
      setPrefill(receiptPrefill(s, actor, read));
      setFormKey((k) => k + 1);
    } catch (e) {
      if (ticket !== lastRead.current) return;
      setPrefill({
        values: {},
        extra: [],
        notice: `Údaje z účtenky nešlo načíst. ${e instanceof Error ? e.message : ""} Vyplňte je ručně.`,
      });
    } finally {
      if (ticket === lastRead.current) setReading(false);
    }
  }
  return (
    <Dialog
      title="Nahrát tankovací účtenku"
      onClose={close}
      dirty={files.length > 0}
    >
      <div className="dialog-body" ref={box}>
        <Form
          key={formKey}
          fields={fields}
          initial={{
            vehicleId: vehicleId || "",
            driverId: actor.driverId || "",
            ...typed,
            ...prefill?.values,
          }}
          submit="Uložit účtenku"
          submitDisabled={reading}
          lead={
            <>
              <FilePicker
                maxBytes={fileLimits.extractionBytes}
                files={files}
                onChange={(next) => void pick(next)}
                label="Vybrat účtenku"
              />
              {reading ? (
                <Notice>Čteme údaje z účtenky…</Notice>
              ) : prefill ? (
                <Notice>{prefill.notice}</Notice>
              ) : (
                !files.length && (
                  <p className="muted">
                    Vyberte PDF účtenky nebo záznamu tankování. Údaje z něj se
                    vyplní samy.
                  </p>
                )
              )}
            </>
          }
          onSubmit={async (values) => {
            try {
              validateUpload({
                ownerType: "fuel",
                ownerId: id,
                type: "Účtenka",
                files,
                idempotencyKey: id + "-file",
              });
            } catch (e) {
              throw new DomainError(
                e instanceof Error ? e.message : "Vyberte účtenku.",
                "files",
              );
            }
            await run(
              {
                type: "save",
                collection: "fuels",
                data: {
                  ...values,
                  ...("cardId" in values
                    ? { cardId: values.cardId || null }
                    : {}),
                  ...(actor.role === "Řidič"
                    ? { driverId: actor.driverId }
                    : {}),
                  id,
                  at: toPragueTimestamp(String(values.at)),
                  full: "Není doloženo",
                  state: "Čeká na výpis",
                },
              },
              id + "-record",
            );
            setSaved(true);
            const jobs = await upload({
              ownerType: "fuel",
              ownerId: id,
              vehicleId: String(values.vehicleId),
              type: "Účtenka",
              files,
              idempotencyKey: id + "-file",
            });
            close();
            const warning = jobs.find((j) =>
              j.error?.includes("nesouhlasí"),
            )?.error;
            if (warning) toast(warning);
            navigate(`/fuels/${id}`);
          }}
        />
      </div>
    </Dialog>
  );
}
