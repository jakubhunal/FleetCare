import { useState } from "react";
import { useFleet } from "../app/context";
import { Dialog, Form, type FieldSpec } from "../components/ui";
import type { Command } from "../data/contracts";
import type { Workspace } from "../domain/models";
import { deadlines } from "../domain/rules";

type Deadline = ReturnType<typeof deadlines>[number];
export function deadlineEdit(
  s: Workspace,
  d: Deadline,
): {
  fields: FieldSpec[];
  initial: { date: string | null; km: number | null };
  command: (v: Record<string, unknown>) => Command;
} | null {
  const fields: FieldSpec[] = [
    ...(d.date !== null || d.km === null
      ? [
          {
            key: "date",
            label: "Datum termínu",
            type: "date" as const,
            required: true,
          },
        ]
      : []),
    ...(d.km !== null
      ? [
          {
            key: "km",
            label: "Km hranice",
            type: "number" as const,
            required: true,
          },
        ]
      : []),
  ];
  const initial = { date: d.date, km: d.km };
  const date = (v: Record<string, unknown>) => (v.date ? String(v.date) : null);
  const record = s.deadlines.find((r) => r.id === d.id);
  if (record)
    return {
      fields,
      initial,
      command: (v) => ({
        type: "save",
        collection: "deadlines",
        id: record.id,
        version: record.version,
        data: { date: date(v), ...(d.km !== null ? { km: v.km } : {}) },
      }),
    };
  const vehicle = s.vehicles.find((v) => d.id === "stk-" + v.id);
  if (vehicle)
    return {
      fields,
      initial,
      command: (v) => ({
        type: "save",
        collection: "vehicles",
        id: vehicle.id,
        version: vehicle.version,
        data: { stkUntil: date(v) },
      }),
    };
  const doc = s.documents.find((x) => d.id === "doc-" + x.id);
  if (doc)
    return {
      fields,
      initial,
      command: (v) => ({
        type: "document.update",
        id: doc.id,
        version: doc.version,
        name: doc.name,
        validUntil: doc.dueAt ? doc.validUntil : date(v),
        dueAt: doc.dueAt ? date(v) : doc.dueAt,
      }),
    };
  const driver = s.drivers.find((r) =>
    [...r.licences, ...r.qualifications].some((l) => r.id + l.name === d.id),
  );
  if (driver)
    return {
      fields,
      initial,
      command: (v) => ({
        type: "save",
        collection: "drivers",
        id: driver.id,
        version: driver.version,
        data: Object.fromEntries(
          (["licences", "qualifications"] as const).map((key) => [
            key,
            driver[key].map((l) =>
              driver.id + l.name === d.id ? { ...l, validUntil: date(v) } : l,
            ),
          ]),
        ),
      }),
    };
  const plan = s.plans.find((p) => p.items.some((i) => i.id === d.id));
  if (plan)
    return {
      fields,
      initial,
      command: (v) => ({
        type: "save",
        collection: "plans",
        id: plan.id,
        version: plan.version,
        data: {
          items: plan.items.map((i) =>
            i.id === d.id
              ? {
                  ...i,
                  nextDate: date(v),
                  nextKm: d.km !== null ? v.km : i.nextKm,
                }
              : i,
          ),
        },
      }),
    };
  return null;
}

export function DeadlineDateDialog({ deadline }: { deadline: Deadline }) {
  const { s, run, close } = useFleet();
  const [dirty, setDirty] = useState(false);
  const target = deadlineEdit(s, deadline);
  if (!target) return null;
  return (
    <Dialog title="Upravit termín" onClose={close} dirty={dirty}>
      <div className="dialog-body">
        <Form
          fields={target.fields}
          initial={target.initial}
          onDirty={setDirty}
          onSubmit={async (values) => {
            await run(target.command(values));
            close();
          }}
        />
      </div>
    </Dialog>
  );
}
