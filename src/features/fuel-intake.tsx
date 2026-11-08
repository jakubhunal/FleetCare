import { fileLimits, validateUpload } from "../data/uploads";
import { DomainError } from "../domain/rules";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useFleet } from "../app/context";
import { Dialog, FilePicker, Form, type FieldSpec } from "../components/ui";
import { localTime, toPragueTimestamp } from "../lib/format";
export function FuelIntakeDialog({ vehicleId }: { vehicleId?: string }) {
  const { s, actor, run, upload, close } = useFleet(),
    navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]),
    [id] = useState(() => crypto.randomUUID()),
    [, setSaved] = useState(false);
  return (
    <Dialog
      title="Nahrát tankovací účtenku"
      onClose={close}
      dirty={files.length > 0}
    >
      <div className="dialog-body">
        <Form
          fields={(
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
          ).filter((f) => actor.role !== "Řidič" || f.key !== "driverId")}
          initial={{
            vehicleId: vehicleId || "",
            driverId: actor.driverId || "",
          }}
          submit="Uložit účtenku"
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
                  ...(actor.role === "Řidič"
                    ? { driverId: actor.driverId }
                    : {}),
                  id,
                  at: toPragueTimestamp(String(values.at)),
                  full: "Není doloženo",
                  state: "Neúplný podklad",
                },
              },
              id + "-record",
            );
            setSaved(true);
            await upload({
              ownerType: "fuel",
              ownerId: id,
              vehicleId: String(values.vehicleId),
              type: "Účtenka",
              files,
              idempotencyKey: id + "-file",
            });
            close();
            navigate(`/fuels/${id}`);
          }}
        >
          <FilePicker
            maxBytes={fileLimits.extractionBytes}
            files={files}
            onChange={setFiles}
            label="Vybrat účtenku"
          />
        </Form>
      </div>
    </Dialog>
  );
}
