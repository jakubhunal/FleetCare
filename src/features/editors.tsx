import { z } from "zod";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  type Entity,
  type Records,
  type Workspace,
  type Driver,
  type Order,
  type Actor,
} from "../domain/models";
import type { EditableCollection } from "../data/contracts";
import { useFleet } from "../app/context";
import {
  Button,
  Dialog,
  Field,
  FilePicker,
  Form,
  Notice,
  type FieldSpec,
} from "../components/ui";
import { DomainError } from "../domain/rules";
import { validateUpload } from "../data/uploads";
import { localTime, toUtc, today } from "../lib/format";
const options = (items: readonly string[]): [string, string][] =>
  items.map((x) => [x, x]);
const vehicleFuels = [
  "Nafta",
  "Benzín",
  "LPG",
  "CNG",
  "Elektro",
  "Hybrid",
] as const;
const categories = ["Kamion", "Nákladní vozidlo", "Dodávka", "Osobní auto"];
const f = (
  key: string,
  label: string,
  type: FieldSpec["type"] = "text",
  required = false,
  extra: Partial<FieldSpec> = {},
): FieldSpec => ({ key, label, type, required, ...extra });
export function editorFields(
  key: EditableCollection,
  s: Workspace,
  actor: Actor,
  existing = false,
): FieldSpec[] {
  const vehicle = f("vehicleId", "Vozidlo", "select", true, {
      options: s.vehicles.map((v) => [v.id, v.spz + " · " + v.model]),
    }),
    driver = f("driverId", "Řidič", "select", true, {
      options: s.drivers.map((d) => [d.id, d.name]),
    }),
    currency = f("currency", "Měna", "select", true, {
      options: options(["CZK", "EUR"]),
      initial: "CZK",
    });
  switch (key) {
    case "vehicles":
      return [
        f("spz", "SPZ", "text", true),
        f("vin", "VIN", "text", false, { help: "Pokud je znám: 17 znaků." }),
        f("model", "Značka / model", "text", true),
        f("year", "Rok výroby", "number"),
        f("category", "Kategorie", "select", true, {
          options: options(categories),
        }),
        f("purpose", "Provozní účel"),
        f("reserve", "Provozní rezerva", "checkbox"),
        f("state", "Provozní stav", "select", true, {
          initial: "V provozu",
          options: options(["V provozu", "V servisu", "Odstaveno"]),
        }),
        f("fuel", "Palivo", "select", false, {
          options: options(vehicleFuels),
        }),
        f("engine", "Motorizace"),
        f("licence", "Požadovaná skupina ŘP", "select", false, {
          options: options(["B", "BE", "C", "C+E", "D"]),
        }),
        f("capacityKg", "Doložená nosnost (kg)", "number"),
        f("volumeM3", "Doložený objem (m³)", "number"),
        f("pallets", "Paletová místa", "number"),
        f("dimensions", "Doložené rozměry (m)"),
        f("configuration", "Konfigurace soupravy"),
        f("equipment", "Vybavení oddělené čárkou"),
        f("stkUntil", "Platnost STK do", "date"),
        f("serviceId", "Nasmlouvaný servis", "select", false, {
          options: s.services.map((x) => [x.id, x.name]),
        }),
      ];
    case "drivers":
      return [
        f("name", "Jméno a příjmení", "text", true),
        f("phone", "Pracovní telefon", "tel"),
        f("email", "Pracovní e-mail", "email"),
        f("medicalState", "Zdravotní způsobilost", "select", true, {
          initial: "Není doloženo",
          options: options(["Není doloženo", "Způsobilý", "Nezpůsobilý"]),
        }),
        f("medicalUntil", "Zdravotní způsobilost do", "date"),
      ];
    case "orders":
      return [
        f("customer", "Zákazník", "text", true),
        f("contact", "Kontakt"),
        f("reference", "Reference"),
        f("cargo", "Náklad"),
        f("category", "Požadovaná kategorie", "select", false, {
          options: options(categories),
        }),
        f("weightKg", "Hmotnost (kg)", "number"),
        f("volumeM3", "Objem (m³)", "number"),
        f("pallets", "Počet palet", "number"),
        f("dimensions", "Rozměry nákladu (m)"),
        f("equipment", "Požadované vybavení (čárkou)"),
        f("licence", "Požadovaná skupina ŘP"),
        f("qualifications", "Požadované kvalifikace (čárkou)"),
        f("priceMinor", "Cena bez DPH", "money"),
        currency,
        f("vat", "DPH (%)", "number"),
        f("state", "Stav zakázky", "select", true, {
          options: options([
            "Přijatá",
            "K doplnění",
            "K přiřazení",
            "Přiřazená",
            "Probíhá",
            "Dokončená",
            "Uzavřená",
            "Zrušená",
          ]),
        }),
        f("internalNote", "Manažerská poznámka", "textarea"),
      ];
    case "trips":
      return [
        vehicle,
        driver,
        f("orderId", "Zakázka", "select", false, {
          options: s.orders.map((o) => [o.id, o.number]),
        }),
        f("purpose", "Účel samostatné jízdy"),
        f("from", "Počáteční místo", "text", true),
        f("startAt", "Začáteční datum", "datetime", true, {
          initial: localTime(),
        }),
        f("startKm", "Počáteční tachometr (km)", "number", true),
        ...(existing
          ? [
              f("to", "Konečné místo"),
              f("endAt", "Konečné datum", "datetime"),
              f("endKm", "Koncový tachometr (km)", "number"),
              f("note", "Poznámka / důvod opravy", "textarea"),
            ]
          : []),
      ];
    case "faults":
      return [
        vehicle,
        f("category", "Kategorie", "select", true, {
          options: options([
            "Brzdová soustava",
            "Motor",
            "Elektroinstalace",
            "Pneumatiky",
            "Karoserie",
            "Jiné",
          ]),
        }),
        f("description", "Popis závady", "textarea", true),
        f("at", "Okamžik hlášení", "datetime", true, { initial: localTime() }),
        f("km", "Nájezd (km)", "number"),
        f("urgency", "Oznámená naléhavost", "select", true, {
          initial: "Střední",
          options: options(["Nízká", "Střední", "Vysoká"]),
        }),
        ...(existing
          ? [
              f("state", "Stav řešení", "select", true, {
                options: options([
                  "Nahlášena",
                  "Řeší se",
                  "Naplánován servis",
                  "V servisu",
                  "Vyřešena",
                  "Uzavřena",
                ]),
              }),
              f("serviceId", "Externí servis", "select", false, {
                options: s.services.map((x) => [x.id, x.name]),
              }),
              f("serviceFrom", "Servis od", "datetime"),
              f("serviceTo", "Servis do", "datetime"),
              f(
                "unavailable",
                "Vozidlo je v tomto období nedostupné",
                "checkbox",
              ),
              f("repair", "Popis opravy", "textarea"),
              f("actualMinor", "Skutečná cena (nenahrazuje výdaj)", "money"),
              currency,
            ]
          : []),
      ];
    case "fuels":
      return [
        vehicle,
        driver,
        f("at", "Datum a čas transakce", "datetime", true, {
          initial: localTime(),
        }),
        f("litres", "Litry (l)", "number"),
        f("amountMinor", "Částka včetně DPH", "money"),
        currency,
        f("fuel", "Palivo"),
        ...(actor.role !== "Řidič"
          ? [
              f("cardId", "CCS karta", "select", false, {
                options: s.cards
                  .filter((c) => c.active)
                  .map((c) => [c.id, c.number]),
              }),
            ]
          : [
              f("cardId", "Identifikátor vlastní CCS karty", "text", false, {
                help: "Pokud jej neznáte, nechte prázdné a doplňte jej později s manažerem.",
              }),
            ]),
        f("station", "Čerpací stanice"),
        f("km", "Tachometr (km)", "number"),
        f("full", "Plná nádrž", "select", true, {
          initial: "Není doloženo",
          options: options(["Ano", "Ne", "Není doloženo"]),
        }),
        ...(existing && actor.role !== "Řidič"
          ? [f("correctionReason", "Důvod opravy", "textarea", true)]
          : []),
      ];
    case "expenses":
      return [
        vehicle,
        f("category", "Kategorie výdaje", "select", true, {
          options: options([
            "Servis",
            "Pneumatiky",
            "Pojištění",
            "Mýto",
            "Poplatky",
            "Jiné",
          ]),
        }),
        f("date", "Datum výdaje", "date", true, { initial: today() }),
        f("amountMinor", "Částka včetně DPH", "money", true),
        currency,
        f("vat", "DPH (%)", "number"),
        f("description", "Popis / důvod", "textarea", true),
        f("paidAt", "Datum úhrady", "date"),
      ];
    case "deadlines":
      return [
        f("title", "Název termínu", "text", true),
        f("type", "Typ", "select", true, {
          options: options(["STK", "Pojištění", "Servis", "Oprávnění"]),
        }),
        { ...vehicle, required: false },
        { ...driver, required: false },
        f("date", "Datum termínu", "date"),
        f("km", "Km hranice", "number"),
        f("responsible", "Odpovědná osoba / role", "text", true, {
          initial: "Fleet manažer",
        }),
        f("priority", "Priorita", "select", true, {
          initial: "Střední",
          options: options(["Nízká", "Střední", "Vysoká"]),
        }),
        f("state", "Stav", "select", true, {
          initial: "Plánováno",
          options: options(["Plánováno", "Vyžaduje řešení", "Splněno"]),
        }),
        f("documentId", "Zdrojový dokument", "select", false, {
          options: s.documents
            .filter((d) => !d.deletedAt)
            .map((d) => [d.id, d.name]),
        }),
      ];
    case "templates":
      return [
        f("name", "Název šablony / varianta", "text", true),
        f("category", "Kategorie", "select", true, {
          options: options(categories),
        }),
      ];
    case "plans":
      return [];
    case "services":
      return [
        f("name", "Název servisu", "text", true),
        f("email", "E-mail", "email"),
        f("phone", "Telefon", "tel"),
        f("address", "Adresa"),
      ];
    case "cards":
      return [
        f("number", "Identifikace CCS karty", "text", true),
        f("active", "Aktivní karta", "checkbox"),
        f(
          "toleranceMinor",
          "Tolerance párování v Kč (včetně)",
          "money",
          false,
          { help: "Prázdné = firemní pravidlo není nastaveno." },
        ),
      ];
  }
}
function Entitlements({
  title,
  value,
  onChange,
}: {
  title: string;
  value: Driver["licences"];
  onChange: (v: Driver["licences"]) => void;
}) {
  return (
    <div className="subform">
      <h3>{title}</h3>
      {value.map((item, i) => (
        <div className="repeat-row" key={i}>
          <Field>
            Název
            <input
              aria-label={`${title} název ${i + 1}`}
              value={item.name}
              onChange={(e) =>
                onChange(
                  value.map((x, n) =>
                    n === i ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
              required
            />
          </Field>
          <Field>
            Platnost do
            <input
              type="date"
              value={item.validUntil || ""}
              onChange={(e) =>
                onChange(
                  value.map((x, n) =>
                    n === i ? { ...x, validUntil: e.target.value || null } : x,
                  ),
                )
              }
            />
          </Field>
          <Button
            aria-label={`Odebrat ${title} ${i + 1}`}
            onClick={() => onChange(value.filter((_, n) => n !== i))}
          >
            <Trash2 size={17} />
          </Button>
        </div>
      ))}
      <Button
        onClick={() => onChange([...value, { name: "", validUntil: null }])}
      >
        <Plus size={16} />
        Přidat {title.toLowerCase()}
      </Button>
    </div>
  );
}
function PlanItems({
  value,
  onChange,
}: {
  value: Records["plans"]["items"];
  onChange: (v: Records["plans"]["items"]) => void;
}) {
  return (
    <div className="subform">
      <h3>Položky plánu</h3>
      {value.map((item, i) => (
        <div className="repeat-card" key={item.id}>
          <div className="repeat-row">
            <Field>
              Název úkonu
              <input
                name={`items.${i}.name`}
                required
                value={item.name}
                onChange={(e) =>
                  onChange(
                    value.map((x, n) =>
                      n === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
            </Field>
            <Button
              danger
              aria-label="Odebrat úkon"
              onClick={() => onChange(value.filter((x) => x.id !== item.id))}
            >
              <Trash2 size={17} />
            </Button>
          </div>
          <div className="form-grid">
            {(
              [
                "intervalKm",
                "intervalMonths",
                "lastKm",
                "lastDate",
                "nextKm",
                "nextDate",
              ] as const
            ).map((key, k) => (
              <Field key={key}>
                {
                  [
                    "Interval (km)",
                    "Interval (měsíců)",
                    "Poslední provedení (km)",
                    "Poslední provedení (datum)",
                    "Další hranice (km)",
                    "Další termín",
                  ][k]
                }
                <input
                  name={`items.${i}.${key}`}
                  type={key.includes("Date") ? "date" : "text"}
                  inputMode={key.includes("Date") ? undefined : "decimal"}
                  value={item[key] ?? ""}
                  onChange={(e) =>
                    onChange(
                      value.map((x, n) =>
                        n === i
                          ? {
                              ...x,
                              [key]: key.includes("Date")
                                ? e.target.value || null
                                : e.target.value.trim()
                                  ? Number(e.target.value.replace(",", "."))
                                  : null,
                            }
                          : x,
                      ),
                    )
                  }
                />
              </Field>
            ))}
          </div>
        </div>
      ))}
      <Button
        onClick={() =>
          onChange([
            ...value,
            {
              id: crypto.randomUUID(),
              name: "",
              intervalKm: null,
              intervalMonths: null,
              lastKm: null,
              lastDate: null,
              nextKm: null,
              nextDate: null,
            },
          ])
        }
      >
        <Plus size={16} />
        Přidat úkon
      </Button>
    </div>
  );
}
function Stops({
  value,
  onChange,
}: {
  value: Order["stops"];
  onChange: (v: Order["stops"]) => void;
}) {
  return (
    <div className="subform">
      <h3>Zastávky a objednaná časová okna</h3>
      {value.map((item, i) => (
        <div className="repeat-card" key={item.id}>
          <div className="form-grid">
            <Field>
              Typ
              <select
                name={`stops.${i}.type`}
                value={item.type}
                onChange={(e) =>
                  onChange(
                    value.map((x, n) =>
                      n === i
                        ? { ...x, type: e.target.value as typeof item.type }
                        : x,
                    ),
                  )
                }
              >
                {["Nakládka", "Vykládka"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field>
              Místo
              <input
                name={`stops.${i}.place`}
                value={item.place}
                onChange={(e) =>
                  onChange(
                    value.map((x, n) =>
                      n === i ? { ...x, place: e.target.value } : x,
                    ),
                  )
                }
              />
            </Field>
            {(["from", "to"] as const).map((key) => (
              <Field key={key}>
                Okno {key === "from" ? "od" : "do"}
                <input
                  name={`stops.${i}.${key}`}
                  type="datetime-local"
                  value={item[key] ? localTime(item[key]) : ""}
                  onChange={(e) =>
                    onChange(
                      value.map((x, n) =>
                        n === i
                          ? {
                              ...x,
                              [key]: e.target.value
                                ? toUtc(e.target.value)
                                : null,
                            }
                          : x,
                      ),
                    )
                  }
                />
              </Field>
            ))}
            <Field>
              Kontakt
              <input
                name={`stops.${i}.contact`}
                value={item.contact}
                onChange={(e) =>
                  onChange(
                    value.map((x, n) =>
                      n === i ? { ...x, contact: e.target.value } : x,
                    ),
                  )
                }
              />
            </Field>
            <Field>
              Pokyny
              <input
                name={`stops.${i}.instructions`}
                value={item.instructions}
                onChange={(e) =>
                  onChange(
                    value.map((x, n) =>
                      n === i ? { ...x, instructions: e.target.value } : x,
                    ),
                  )
                }
              />
            </Field>
          </div>
        </div>
      ))}
    </div>
  );
}
const names: Record<EditableCollection, string> = {
  vehicles: "vozidlo",
  drivers: "řidiče",
  orders: "zakázku",
  trips: "jízdu",
  faults: "závadu",
  fuels: "tankování",
  expenses: "výdaj",
  deadlines: "termín",
  templates: "šablonu",
  plans: "servisní plán",
  services: "externí servis",
  cards: "CCS kartu",
};
export function EntityEditor({
  collection,
  record,
  defaults = {},
  startTrip = false,
}: {
  collection: EditableCollection;
  record?: Entity;
  defaults?: Record<string, unknown>;
  startTrip?: boolean;
}) {
  const { s, actor, run, upload, close } = useFleet();
  const [attachment, setAttachment] = useState<File[]>([]);
  const [savedExpenseVehicle, setSavedExpenseVehicle] = useState<string | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const data: Record<string, unknown> = { ...record, ...defaults };
  const fields = editorFields(collection, s, actor, !!record);
  const [licences, setLicences] = useState(
      (record && "licences" in record
        ? record.licences
        : []) as Driver["licences"],
    ),
    [qualifications, setQualifications] = useState(
      (record && "qualifications" in record
        ? record.qualifications
        : []) as Driver["qualifications"],
    );
  const [templateId, setTemplateId] = useState(
    record && "templateId" in record ? String(record.templateId || "") : "",
  );
  const [items, setItems] = useState(
    (record && "items" in record
      ? record.items
      : []) as Records["plans"]["items"],
  );
  const [stops, setStops] = useState<Order["stops"]>(
    (() => {
      const existing = record && "stops" in record ? record.stops : [];
      return [
        existing[0],
        existing.length > 1 ? existing.at(-1) : undefined,
      ].map((stop, i) => ({
        id: crypto.randomUUID(),
        place: "",
        from: null,
        to: null,
        contact: "",
        instructions: "",
        ...stop,
        type: i === 0 ? ("Nakládka" as const) : ("Vykládka" as const),
      }));
    })(),
  );
  const [bindings, setBindings] = useState(
    record && "bindings" in record ? record.bindings : [],
  );
  for (const field of fields) {
    if (field.type === "datetime" && typeof data[field.key] === "string")
      data[field.key] = localTime(data[field.key] as string);
    if (
      ["equipment", "qualifications"].includes(field.key) &&
      Array.isArray(data[field.key])
    )
      data[field.key] = (data[field.key] as string[]).join(", ");
  }
  const change =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setDirty(true);
      setter(v);
    };
  return (
    <Dialog
      title={
        startTrip
          ? "Zahájit jízdu"
          : `${record ? "Upravit" : "Přidat"} ${names[collection]}`
      }
      dirty={dirty}
      onClose={close}
    >
      <div className="dialog-body">
        {collection === "faults" && !record && (
          <Notice>
            Hlášení se uloží společně s oddělenými požadavky na komunikaci.
            E-maily v lokálním režimu nejsou odesílány.
          </Notice>
        )}
        <Form
          fields={fields}
          initial={data}
          onDirty={setDirty}
          submit={startTrip ? "Zahájit jízdu" : "Uložit"}
          onSubmit={async (values) => {
            values = { ...defaults, ...values };
            for (const field of fields) {
              if (field.type === "datetime")
                values[field.key] = values[field.key]
                  ? toUtc(String(values[field.key]))
                  : null;
            }
            for (const field of [
              "equipment",
              ...(collection === "orders" ? ["qualifications"] : []),
            ])
              if (field in values)
                values[field] = String(values[field])
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean);
            const nullable = [
              "stkUntil",
              "serviceId",
              "medicalUntil",
              "orderId",
              "endAt",
              "serviceFrom",
              "serviceTo",
              "cardId",
              "paidAt",
              "originalId",
              "vehicleId",
              "driverId",
              "date",
              "documentId",
            ];
            for (const k of nullable) if (values[k] === "") values[k] = null;
            if (collection === "drivers") {
              values.licences = licences;
              values.qualifications = qualifications;
            }
            if (collection === "templates" || collection === "plans")
              values.items = items;
            if (collection === "templates" || collection === "plans") {
              const issues: z.core.$ZodIssue[] = [];
              items.forEach((item, index) => {
                if (
                  !(
                    (item.intervalKm ?? 0) > 0 || (item.intervalMonths ?? 0) > 0
                  )
                )
                  for (const field of ["intervalKm", "intervalMonths"])
                    issues.push({
                      code: "custom",
                      path: ["items", index, field],
                      message: "Zadejte kladný interval v km nebo měsících.",
                    });
              });
              if (issues.length) throw new z.ZodError(issues);
            }
            if (collection === "plans") values.templateId = templateId || null;
            if (collection === "orders") values.stops = stops;
            if (collection === "expenses") {
              values.kind = record && "kind" in record ? record.kind : "Výdaj";
              values.originalId =
                record && "originalId" in record ? record.originalId : null;
            }
            if (collection === "cards") values.bindings = bindings;
            if (collection === "faults" && !record) {
              values.state = "Nahlášena";
              values.caseReference = "FC-" + key;
              values.driverId = actor.driverId;
            }
            if (collection === "expenses" && !record) {
              const vehicleId = savedExpenseVehicle || String(values.vehicleId);
              const input = {
                ownerType: "expense" as const,
                ownerId: key,
                vehicleId,
                type: "Příloha" as const,
                files: attachment,
                idempotencyKey: key + "-attachment",
              };
              if (attachment.length) {
                try {
                  validateUpload(input);
                } catch (e) {
                  throw new DomainError(
                    e instanceof Error ? e.message : "Neplatná příloha.",
                    "files",
                  );
                }
              }
              if (!savedExpenseVehicle) {
                await run(
                  {
                    type: "save",
                    collection: "expenses",
                    data: { ...values, id: key },
                  },
                  key,
                );
                setSavedExpenseVehicle(vehicleId);
              }
              if (attachment.length) await upload(input);
              close();
              return;
            }
            if (startTrip) await run({ type: "trip.start", data: values }, key);
            else
              await run(
                {
                  type: "save",
                  collection,
                  id: record?.id,
                  version: record?.version,
                  data: values,
                },
                key,
              );
            close();
          }}
        >
          {collection === "expenses" && !record && (
            <>
              <FilePicker
                files={attachment}
                onChange={(files) => {
                  setAttachment(files);
                  setDirty(true);
                }}
                label="Přidat přílohu"
              />
              {savedExpenseVehicle && (
                <Notice>
                  Výdaj je uložen. Pokud nahrání přílohy selhalo, zopakujte
                  uložení; nový výdaj nevznikne. Údaje výdaje lze poté upravit v
                  jeho detailu.
                </Notice>
              )}
            </>
          )}
          {collection === "drivers" && (
            <>
              <Entitlements
                title="Oprávnění"
                value={licences}
                onChange={change(setLicences)}
              />
              <Entitlements
                title="Kvalifikace"
                value={qualifications}
                onChange={change(setQualifications)}
              />
            </>
          )}
          {collection === "plans" && (
            <Field>
              Šablona
              <select
                value={templateId}
                onChange={(e) => {
                  setDirty(true);
                  setTemplateId(e.target.value);
                  const template = s.templates.find(
                    (t) => t.id === e.target.value,
                  );
                  if (template)
                    setItems(
                      template.items.map((i) => ({
                        ...i,
                        id: crypto.randomUUID(),
                      })),
                    );
                }}
              >
                <option value="">Individuální plán</option>
                {s.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <small>
                Výběr šablony předvyplní úkony. Změny se uloží až potvrzením
                formuláře.
              </small>
            </Field>
          )}
          {(collection === "templates" || collection === "plans") && (
            <PlanItems value={items} onChange={change(setItems)} />
          )}
          {collection === "orders" && (
            <Stops value={stops} onChange={change(setStops)} />
          )}
          {collection === "cards" && (
            <div className="subform">
              <h3>Časové vazby k vozidlu</h3>
              {bindings.map((b, i) => (
                <div className="repeat-card" key={i}>
                  <div className="form-grid">
                    <Field>
                      Vozidlo
                      <select
                        name={`bindings.${i}.vehicleId`}
                        value={b.vehicleId}
                        required
                        onChange={(e) => {
                          setDirty(true);
                          setBindings(
                            bindings.map((x, n) =>
                              n === i ? { ...x, vehicleId: e.target.value } : x,
                            ),
                          );
                        }}
                      >
                        <option value="">Vyberte…</option>
                        {s.vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.spz}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {(["from", "to"] as const).map((k) => (
                      <Field key={k}>
                        Platnost {k === "from" ? "od" : "do"}
                        <input
                          name={`bindings.${i}.${k}`}
                          type="date"
                          required={k === "from"}
                          value={b[k] || ""}
                          onChange={(e) => {
                            setDirty(true);
                            setBindings(
                              bindings.map((x, n) =>
                                n === i
                                  ? { ...x, [k]: e.target.value || null }
                                  : x,
                              ),
                            );
                          }}
                        />
                      </Field>
                    ))}
                  </div>
                  <Button
                    danger
                    onClick={() =>
                      setBindings(bindings.filter((_, n) => n !== i))
                    }
                  >
                    Odebrat vazbu
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => {
                  setDirty(true);
                  setBindings([
                    ...bindings,
                    { vehicleId: "", from: today(), to: null },
                  ]);
                }}
              >
                Přidat časovou vazbu
              </Button>
            </div>
          )}
        </Form>
      </div>
    </Dialog>
  );
}
export function useEditors() {
  const { show } = useFleet();
  return (
    collection: EditableCollection,
    record?: Entity,
    defaults?: Record<string, unknown>,
    startTrip = false,
  ) =>
    show(
      <EntityEditor
        key={crypto.randomUUID()}
        collection={collection}
        record={record}
        defaults={defaults}
        startTrip={startTrip}
      />,
    );
}
