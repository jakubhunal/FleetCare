import {
  individualPlanSave,
  planFormErrors,
  validatePlanItems,
} from "../lib/service-plan-save";
import { odometerErrors } from "../lib/form-validation";
import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  type Entity,
  type Records,
  type Workspace,
  type Driver,
  type Order,
  type Actor,
  tripStatus,
  planItemSchema,
} from "../domain/models";
import type { EditableCollection } from "../data/contracts";
import { useFleet } from "../app/context";
import {
  Button,
  Dialog,
  Field,
  FilePicker,
  Form,
  ViewToggle,
  Notice,
  useConfirmDelete,
  type FieldSpec,
} from "../components/ui";
import { DomainError } from "../domain/rules";
import { validateUpload } from "../data/uploads";
import { localTime, toPragueTimestamp, today } from "../lib/format";
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
        f("vin", "VIN", "text", !existing, { help: "17 platných znaků." }),
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
        f("stkUntil", "Platnost STK do", "date", !existing),
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
        f("urgency", "Naléhavost", "select", true, {
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
        f("litres", "Litry (l)", "number", true),
        f("amountMinor", "Částka včetně DPH", "money", true),
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
        vehicle,
        { ...driver, required: false },
        f("date", "Datum termínu", "date", true),
        f("km", "Km hranice", "number"),
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
        f("active", "Aktivní karta", "select", true, {
          initial: "true",
          options: [
            ["true", "Ano"],
            ["false", "Ne"],
          ],
        }),
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
  persisted = false,
}: {
  title: string;
  value: Driver["licences"];
  onChange: (v: Driver["licences"]) => void;
  persisted?: boolean;
}) {
  const { confirmDelete, confirmation } = useConfirmDelete();
  const [savedRows, setSavedRows] = useState(() => value.map(() => persisted));
  return (
    <div className="subform">
      {confirmation}
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
            onClick={() => {
              const remove = () => {
                setSavedRows((rows) => rows.filter((_, n) => n !== i));
                onChange(value.filter((_, n) => n !== i));
              };
              if (savedRows[i])
                confirmDelete({
                  title:
                    title === "Oprávnění"
                      ? "Odebrat oprávnění?"
                      : "Odebrat kvalifikaci?",
                  description: `Opravdu chcete odebrat položku „${item.name || title}“?`,
                  label: "Odebrat",
                  action: remove,
                });
              else remove();
            }}
          >
            <Trash2 size={17} />
          </Button>
        </div>
      ))}
      <Button
        onClick={() => {
          setSavedRows((rows) => [...rows, false]);
          onChange([...value, { name: "", validUntil: null }]);
        }}
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
  persistedIds = [],
}: {
  value: Records["plans"]["items"];
  onChange: (v: Records["plans"]["items"]) => void;
  persistedIds?: string[];
}) {
  const { confirmDelete, confirmation } = useConfirmDelete();
  return (
    <div className="subform">
      {confirmation}
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
              onClick={() => {
                const remove = () =>
                  onChange(value.filter((x) => x.id !== item.id));
                if (persistedIds.includes(item.id))
                  confirmDelete({
                    title: "Odebrat úkon?",
                    description: `Opravdu chcete odebrat úkon „${item.name || "Bez názvu"}“?`,
                    label: "Odebrat",
                    action: remove,
                  });
                else remove();
              }}
            >
              <Trash2 size={17} />
            </Button>
          </div>
          <p>Vyplňte alespoň jeden interval: kilometry nebo měsíce.</p>
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
              <Field
                key={key}
                requiredMark={key === "intervalKm" || key === "intervalMonths"}
              >
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
                  inputMode={key.includes("Date") ? undefined : "numeric"}
                  aria-required={
                    key === "intervalKm"
                      ? !(item.intervalMonths && item.intervalMonths > 0)
                      : key === "intervalMonths"
                        ? !(item.intervalKm && item.intervalKm > 0)
                        : undefined
                  }
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
function ServicePlanDialog({
  vehicleId,
  record,
}: {
  vehicleId: string;
  record?: Records["plans"];
}) {
  const { s, run, close } = useFleet();
  const [mode, setMode] = useState<"template" | "individual">(
    record && !record.templateId ? "individual" : "template",
  );
  const [switchTo, setSwitchTo] = useState<"template" | "individual" | null>(
    null,
  );
  const [templateId, setTemplateId] = useState(record?.templateId || "");
  const [items, setItems] = useState<Records["plans"]["items"]>(
    record?.items || [],
  );
  const [dirty, setDirty] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<"form" | "ask" | "name">("form");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const attempt = useRef<ReturnType<typeof individualPlanSave> | null>(null);
  const persist = async (templateName?: string) => {
    if (saving) return;
    if (!attempt.current)
      attempt.current = individualPlanSave({
        key,
        vehicleId,
        category: s.vehicles.find((v) => v.id === vehicleId)?.category || "",
        items,
        templateName,
      });
    setSaving(true);
    setSaveError("");
    try {
      await attempt.current.save(run);
      close();
    } catch (error) {
      const progress = attempt.current.progress;
      const warning = progress.templateSaved
        ? "Šablona je uložená, ale uložení plánu nebylo potvrzeno. Opakujte uložení; další šablona se nevytvoří. "
        : progress.templateAttempted
          ? "Uložení nebylo dokončeno. Šablona již může být uložená. Opakováním dokončíte uložení bez vytvoření další šablony. "
          : "";
      setSaveError(
        warning + (error instanceof Error ? error.message : "Uložení selhalo."),
      );
    } finally {
      setSaving(false);
    }
  };
  const switchMode = (next: "template" | "individual") => {
    setMode(next);
    setTemplateId("");
    setItems([]);
    setSwitchTo(null);
    setDirty(true);
  };
  return (
    <Dialog
      title={record ? "Upravit servisní plán" : "Přidat servisní plán"}
      dirty={
        !saving && !switchTo && (step === "form" ? dirty : !!attempt.current)
      }
      onClose={() => {
        if (saving) return;
        if (switchTo) setSwitchTo(null);
        else if (step !== "form" && !attempt.current) setStep("form");
        else close();
      }}
    >
      <div className="dialog-body">
        {switchTo && (
          <div>
            <p>Přepnutím se zahodí rozpracované úkony. Pokračovat?</p>
            <div className="actions">
              <Button onClick={() => setSwitchTo(null)}>Zrušit</Button>
              <Button danger onClick={() => switchMode(switchTo)}>
                Pokračovat
              </Button>
            </div>
          </div>
        )}
        {step !== "form" && (
          <div aria-busy={saving}>
            <h3 className="service-plan-save-question">
              Chcete uložit jako šablonu?
            </h3>
            {saveError && <Notice error>{saveError}</Notice>}
            {step === "ask" ? (
              <div className="actions">
                <Button
                  disabled={saving || !!attempt.current}
                  onClick={() => setStep("name")}
                >
                  Ano
                </Button>
                <Button
                  primary
                  disabled={saving}
                  onClick={() => void persist()}
                >
                  Ne
                </Button>
              </div>
            ) : (
              <Form
                fields={[
                  {
                    key: "name",
                    label: "Název šablony",
                    required: true,
                    disabled: !!attempt.current,
                  },
                ]}
                onSubmit={async (values) => {
                  await persist(String(values.name));
                }}
              />
            )}
          </div>
        )}
        <div hidden={!!switchTo || step !== "form"}>
          <ViewToggle
            label="Způsob vytvoření servisního plánu"
            value={mode}
            items={[
              { value: "template", label: "Šablona" },
              { value: "individual", label: "Individuální plán" },
            ]}
            onChange={(value) => {
              const next = value as typeof mode;
              if (next === mode) return;
              if (templateId || items.length) setSwitchTo(next);
              else switchMode(next);
            }}
          />
          <Form
            fields={[]}
            validate={planFormErrors}
            submitDisabled={
              !record && mode === "individual" && items.length === 0
            }
            onDirty={(value) => {
              if (value) setDirty(true);
            }}
            onSubmit={async () => {
              validatePlanItems(items);
              planItemSchema.array().parse(items);
              if (mode === "individual" && !record) {
                setStep("ask");
                return;
              }
              await run(
                {
                  type: "save",
                  collection: "plans",
                  id: record?.id,
                  version: record?.version,
                  data: { vehicleId, templateId: templateId || null, items },
                },
                key,
              );
              close();
            }}
          >
            {mode === "template" && (
              <Field>
                Šablona
                <select
                  value={templateId}
                  onChange={(e) => {
                    setTemplateId(e.target.value);
                    const template = s.templates.find(
                      (t) => t.id === e.target.value,
                    );
                    setItems(
                      template
                        ? template.items.map((i) => ({
                            ...i,
                            id: crypto.randomUUID(),
                          }))
                        : [],
                    );
                    setDirty(true);
                  }}
                >
                  <option value="">
                    {s.templates.length ? "Vyberte šablonu" : "Žádné šablony"}
                  </option>
                  {s.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {mode === "template" && !s.templates.length && (
              <p>
                Nejsou k dispozici žádné šablony. Přepněte na Individuální plán.
              </p>
            )}
            {(mode === "individual" || !!templateId) && (
              <PlanItems
                persistedIds={record?.items.map((item) => item.id)}
                value={items}
                onChange={(next) => {
                  setItems(next);
                  setDirty(true);
                }}
              />
            )}
          </Form>
        </div>
      </div>
    </Dialog>
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
                                ? toPragueTimestamp(e.target.value)
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
  templates: "servisní plán",
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
  const { confirmDelete, confirmation } = useConfirmDelete();
  const [attachment, setAttachment] = useState<File[]>([]);
  const [savedExpenseVehicle, setSavedExpenseVehicle] = useState<string | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const data: Record<string, unknown> = { ...record, ...defaults };
  const driverMode = actor.role === "Řidič";
  const trip =
    collection === "trips" && record ? (record as Records["trips"]) : null;
  const incomplete = trip && tripStatus(trip) === "Ukončena neúplná";
  let fields = editorFields(collection, s, actor, !!record).filter(
    (f) =>
      !(
        driverMode &&
        ["trips", "fuels"].includes(collection) &&
        f.key === "driverId"
      ),
  );
  fields = fields.map((f) => ({
    ...f,
    disabled:
      !!(incomplete && f.key !== "endKm") ||
      !!(driverMode && trip && f.key === "startKm"),
    required:
      f.required ||
      (f.key === "endKm" && !!trip && (driverMode || !!incomplete)),
    label: driverMode && f.key === "note" ? "Poznámka" : f.label,
  }));
  if (trip) {
    const pairs = ["from", "to", "startAt", "endAt", "startKm", "endKm"];
    fields = [
      ...fields.filter((f) => !pairs.includes(f.key) && f.key !== "note"),
      ...pairs.flatMap((key) => fields.filter((f) => f.key === key)),
      ...fields.filter((f) => f.key === "note"),
    ];
  }
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
  const [savedBindings, setSavedBindings] = useState(() =>
    bindings.map(() => true),
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
        driverMode && trip
          ? "Ukončit jízdu"
          : startTrip
            ? "Zahájit jízdu"
            : !record && collection === "faults"
              ? "Nahlásit závadu"
              : !record && collection === "fuels"
                ? "Zadat tankování"
                : `${record ? "Upravit" : "Přidat"} ${names[collection]}`
      }
      dirty={dirty}
      onClose={close}
    >
      <div className="dialog-body">
        {confirmation}
        <Form
          fields={fields}
          validate={
            collection === "trips"
              ? odometerErrors
              : collection === "plans" || collection === "templates"
                ? planFormErrors
                : undefined
          }
          initial={data}
          onDirty={setDirty}
          submit={startTrip ? "Zahájit jízdu" : "Uložit"}
          onSubmit={async (values) => {
            values = { ...defaults, ...values };
            if (collection === "deadlines" && !record)
              values.responsible = "Fleet manažer";
            if (driverMode && ["trips", "fuels"].includes(collection))
              values.driverId = actor.driverId;
            if (collection === "trips" && record) {
              const previous = record as Records["trips"];
              values.state =
                (previous.state === "Probíhá" &&
                  !previous.endAt &&
                  values.endAt) ||
                (previous.endAt &&
                  previous.endKm === null &&
                  values.endKm !== null)
                  ? values.endKm === null
                    ? "Ukončena neúplná"
                    : "K ověření"
                  : previous.state;
            }
            for (const field of fields) {
              if (field.type === "datetime")
                values[field.key] = values[field.key]
                  ? toPragueTimestamp(String(values[field.key]))
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
              if (record) values.qualifications = qualifications;
            }
            if (collection === "templates" || collection === "plans")
              values.items = items;
            if (collection === "templates" || collection === "plans") {
              validatePlanItems(items);
            }
            if (collection === "orders") values.stops = stops;
            if (collection === "expenses") {
              values.kind = record && "kind" in record ? record.kind : "Výdaj";
              values.originalId =
                record && "originalId" in record ? record.originalId : null;
            }
            if (collection === "cards") {
              values.bindings = bindings;
              values.active = String(values.active) === "true";
            }
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
            </>
          )}
          {collection === "drivers" && (
            <>
              <Entitlements
                title="Oprávnění"
                persisted={!!record}
                value={licences}
                onChange={change(setLicences)}
              />
              {record && (
                <Entitlements
                  title="Kvalifikace"
                  persisted={!!record}
                  value={qualifications}
                  onChange={change(setQualifications)}
                />
              )}
            </>
          )}
          {(collection === "templates" || collection === "plans") && (
            <PlanItems
              persistedIds={
                record && "items" in record
                  ? record.items.map((item) => item.id)
                  : []
              }
              value={items}
              onChange={change(setItems)}
            />
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
                    onClick={() => {
                      const remove = () => {
                        setDirty(true);
                        setSavedBindings((rows) =>
                          rows.filter((_, n) => n !== i),
                        );
                        setBindings(bindings.filter((_, n) => n !== i));
                      };
                      if (savedBindings[i])
                        confirmDelete({
                          title: "Odebrat vazbu?",
                          description: `Opravdu chcete odebrat vazbu karty „${String(data.number || "CCS")}“ na vozidlo „${s.vehicles.find((v) => v.id === b.vehicleId)?.spz || b.vehicleId}“?`,
                          label: "Odebrat",
                          action: remove,
                        });
                      else remove();
                    }}
                  >
                    Odebrat vazbu
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => {
                  setDirty(true);
                  setSavedBindings((rows) => [...rows, false]);
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
      collection === "plans" ? (
        <ServicePlanDialog
          key={crypto.randomUUID()}
          vehicleId={String(
            (record && "vehicleId" in record
              ? record.vehicleId
              : defaults?.vehicleId) || "",
          )}
          record={record as Records["plans"] | undefined}
        />
      ) : (
        <EntityEditor
          key={crypto.randomUUID()}
          collection={collection}
          record={record}
          defaults={defaults}
          startTrip={startTrip}
        />
      ),
    );
}
