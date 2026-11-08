import { StatusChip } from "../components/status-chip";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useParams } from "react-router";
import { useFleet } from "../app/context";
import {
  Button,
  DataTable,
  Form,
  Field,
  PageHead,
  Panel,
  Tabs,
} from "../components/ui";
import { useEditors } from "./editors";
import { date, number } from "../lib/format";
export function SettingsPage() {
  const { tab = "terms" } = useParams();
  const { s, run } = useFleet(),
    edit = useEditors();
  const [days, setDays] = useState<string[]>(
    (s.settings.daysBefore || []).map(String),
  );
  return (
    <>
      <PageHead
        title="Nastavení"
        subtitle="Provozní pravidla, servisní šablony a CCS karty."
      />
      <div className="panel">
        <Tabs
          base="/settings"
          selected={tab}
          items={[
            ["terms", "Upozornění"],
            ["plans", "Servisní plány"],
            ["cards", "CCS karty"],
            ["contacts", "Kontakty"],
          ]}
        />
        <div className="detail-body">
          {tab === "terms" && (
            <>
              <Form
                key={JSON.stringify(s.settings)}
                fields={[
                  {
                    key: "managerEmail",
                    label: "E-mail fleet manažera",
                    type: "email",
                  },
                  {
                    key: "kmBefore",
                    label: "Km před servisní hranicí",
                    type: "number",
                  },
                ]}
                initial={{
                  ...s.settings,
                  daysBefore: s.settings.daysBefore?.join(", ") || "",
                }}
                onSubmit={async (v) => {
                  await run({
                    type: "settings",
                    data: {
                      managerEmail: String(v.managerEmail),
                      daysBefore: days.length ? days.map(Number) : null,
                      kmBefore: v.kmBefore as number | null,
                    },
                  });
                }}
              >
                <div className="subform">
                  <h3>Dny před termínem</h3>
                  {days.map((value, i) => (
                    <div className="repeat-row" key={i}>
                      <Field>
                        Počet dní
                        <input
                          name={`daysBefore.${i}`}
                          inputMode="numeric"
                          required
                          value={value}
                          onChange={(e) =>
                            setDays(
                              days.map((v, n) =>
                                n === i ? e.target.value : v,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Button
                        danger
                        aria-label={`Odebrat termín ${i + 1}`}
                        onClick={() => setDays(days.filter((_, n) => n !== i))}
                      >
                        <Trash2 size={17} />
                      </Button>
                    </div>
                  ))}
                  <Button onClick={() => setDays([...days, ""])}>
                    {days.length ? "Přidat další termín" : "Přidat termín"}
                  </Button>
                </div>
              </Form>
            </>
          )}
          {tab === "plans" && (
            <>
              <div className="section-actions">
                <Button primary onClick={() => edit("templates")}>
                  Přidat servisní plán
                </Button>
              </div>

              {s.templates.map((t) => (
                <Panel
                  key={t.id}
                  title={t.name}
                  action={
                    <Button onClick={() => edit("templates", t)}>
                      Upravit šablonu
                    </Button>
                  }
                >
                  <p>{t.category}</p>
                  {t.items.map((i) => (
                    <div className="list-item" key={i.id}>
                      <strong>{i.name}</strong>
                      <span>
                        {number(i.intervalKm, "km")} /{" "}
                        {number(i.intervalMonths, "měsíců")}
                      </span>
                    </div>
                  ))}
                </Panel>
              ))}
            </>
          )}
          {tab === "contacts" && (
            <Panel
              title="Externí servis"
              action={
                <Button
                  primary={!s.services.length}
                  onClick={() => edit("services", s.services[0])}
                >
                  {s.services.length
                    ? "Upravit kontakt"
                    : "Přidat servisní kontakt"}
                </Button>
              }
            >
              {s.services[0] ? (
                <>
                  <h3>{s.services[0].name}</h3>
                  <p>
                    {s.services[0].email || "E-mail chybí"} ·{" "}
                    {s.services[0].phone} · {s.services[0].address}
                  </p>
                </>
              ) : (
                <p className="muted">
                  Zatím není založen žádný servisní kontakt.
                </p>
              )}
            </Panel>
          )}
          {tab === "cards" && (
            <DataTable
              rows={s.cards}
              search={(c) => c.number}
              toolbarActions={
                <Button
                  primary
                  onClick={() => edit("cards", undefined, { active: true })}
                >
                  Přidat CCS kartu
                </Button>
              }
              columns={[
                {
                  key: "number",
                  label: "CCS karta",
                  sort: (c) => c.number,
                  render: (c) => <strong>{c.number}</strong>,
                },
                {
                  key: "state",
                  label: "Stav",
                  render: (c) => (
                    <StatusChip
                      entity="card"
                      value={c.active ? "Aktivní" : "Neaktivní"}
                    />
                  ),
                },
                {
                  key: "tolerance",
                  label: "Tolerance",
                  sort: (c) => c.toleranceMinor,
                  render: (c) =>
                    c.toleranceMinor === null
                      ? "Není nastavena"
                      : number(c.toleranceMinor / 100, "Kč včetně"),
                },
                {
                  key: "bindings",
                  label: "Vozidla / období",
                  render: (c) =>
                    c.bindings.map((b, i) => (
                      <small key={i}>
                        {s.vehicles.find((v) => v.id === b.vehicleId)?.spz ||
                          "Vozidlo není dostupné"}{" "}
                        · {date(b.from)} — {b.to ? date(b.to) : "Trvá"}
                      </small>
                    )),
                },
                {
                  key: "actions",
                  label: "Akce",
                  render: (c) => (
                    <Button onClick={() => edit("cards", c)}>
                      Upravit kartu
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
    </>
  );
}
