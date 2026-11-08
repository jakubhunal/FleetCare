import { Plus, Upload } from "lucide-react";
import { useNavigate } from "react-router";
import { useFleet } from "../app/context";
import { Button, Dialog, ChoiceButton } from "../components/ui";
import { useEditors } from "./editors";
import { useUpload, type UploadResult } from "./documents";
import type { JobStatus } from "../data/contracts";
import type { Vehicle } from "../domain/models";
import { date, normalize } from "../lib/format";

const fieldLabels: Record<string, string> = {
  spz: "SPZ",
  vin: "VIN",
  model: "značka",
  category: "kategorie",
  stkUntil: "platnost STK",
};

/** Text above the prefilled vehicle form, saying what was read and what not. */
export function stkIntakeNotice(job: JobStatus | undefined) {
  const attach = "Po uložení se protokol k vozidlu připojí automaticky.";
  if (!job || job.state === "not_configured")
    return `STK je nahraná. Automatické čtení údajů není v tomto režimu připojené – doplňte údaje podle protokolu a uložte. ${attach}`;
  if (job.state === "failed")
    return `STK je nahraná, ale údaje z ní nešlo načíst. ${job.error || "Vyplňte je ručně podle protokolu."} ${attach}`;
  const read = Object.keys(fieldLabels)
    .filter((k) => job.fields?.[k as keyof typeof job.fields] !== undefined)
    .map((k) => fieldLabels[k]);
  const extra = [
    job.fields?.odometerKm !== undefined &&
      `tachometr dle protokolu ${job.fields.odometerKm.toLocaleString("cs-CZ")} km`,
    job.fields?.inspectionDate &&
      `prohlídka ${date(job.fields.inspectionDate)}`,
    job.fields?.result && `výsledek „${job.fields.result}“`,
  ].filter(Boolean);
  return [
    `Údaje jsme načetli z nahrané STK (${read.join(", ")}). Zkontrolujte je a uložte.`,
    job.missingFields?.length
      ? `V dokumentu chybí: ${job.missingFields.join(", ")} – doplňte podle originálu protokolu, nic neodhadujeme.`
      : "",
    extra.length ? `Z protokolu dále: ${extra.join(", ")}.` : "",
    attach,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Existing vehicle with the same VIN or SPZ as the uploaded STK. */
export function matchingVehicle(vehicles: Vehicle[], job?: JobStatus) {
  const f = job?.fields;
  if (!f) return undefined;
  return vehicles.find(
    (v) =>
      (f.vin && v.vin && normalize(v.vin) === normalize(f.vin)) ||
      (f.spz && normalize(v.spz) === normalize(f.spz)),
  );
}

/**
 * Přidat vozidlo → Nahrát STK: the protocol is stored first (as an intake
 * document keyed by the future vehicle id) and the gateway reads SPZ, VIN,
 * make, category and STK validity from it. The vehicle form then opens
 * prefilled for a check; saving it attaches the protocol (see the vehicles
 * branch of applyCommand). An STK of a car already in the fleet is attached
 * to that car instead of creating a second one.
 */
function useStkIntake() {
  const edit = useEditors();
  const upload = useUpload();
  const { s, run, show, close, toast } = useFleet();
  const navigate = useNavigate();
  const attachTo = async (job: JobStatus, vehicle: Vehicle) => {
    await run({ type: "document.link", id: job.jobId, vehicleId: vehicle.id });
    close();
    toast(`STK připojena k vozidlu ${vehicle.spz}.`);
    navigate(`/vehicles/${vehicle.id}/documents`);
  };
  return () => {
    const vehicleId = crypto.randomUUID();
    upload(
      "intake",
      vehicleId,
      undefined,
      "STK",
      ({ validUntil, jobs }: UploadResult) => {
        const job = jobs.find((j) => j.fields) || jobs[0];
        const f = job?.fields || {};
        const existing = matchingVehicle(s.vehicles, job);
        if (existing && job)
          return show(
            <Dialog title="Vozidlo už v evidenci je" onClose={close}>
              <div className="dialog-body">
                <p>
                  Podle nahrané STK ({f.spz || f.vin}) jde o vozidlo{" "}
                  <strong>
                    {existing.spz} · {existing.model}
                  </strong>
                  , které už v evidenci je. Druhé vozidlo nezakládáme – protokol
                  připojíme k tomuto vozidlu
                  {f.stkUntil
                    ? ` a platnost STK posuneme na ${date(f.stkUntil)}, pokud je novější`
                    : ""}
                  .
                </p>
                <div className="actions">
                  <Button primary onClick={() => attachTo(job, existing)}>
                    Připojit STK k vozidlu {existing.spz}
                  </Button>
                  <Button onClick={close}>Zrušit</Button>
                </div>
              </div>
            </Dialog>,
          );
        const stkUntil = validUntil || f.stkUntil;
        edit(
          "vehicles",
          undefined,
          {
            id: vehicleId,
            ...(f.spz ? { spz: f.spz } : {}),
            ...(f.vin ? { vin: f.vin } : {}),
            ...(f.model ? { model: f.model } : {}),
            ...(f.category ? { category: f.category } : {}),
            ...(stkUntil ? { stkUntil } : {}),
          },
          false,
          stkIntakeNotice(job),
        );
      },
    );
  };
}

export function useAddVehicle() {
  const { show, close } = useFleet();
  const edit = useEditors();
  const stk = useStkIntake();
  return () =>
    show(
      <Dialog title="Přidat vozidlo" onClose={close}>
        <div className="dialog-body">
          <p>Zvolte způsob přidání vozidla.</p>
          <div className="actions">
            <Button primary onClick={() => edit("vehicles")}>
              <Plus size={18} /> Zadat ručně
            </Button>
            <Button onClick={stk}>
              <Upload size={18} /> Nahrát STK
            </Button>
          </div>
        </div>
      </Dialog>,
    );
}

export function AddVehicleButton() {
  const edit = useEditors();
  const stk = useStkIntake();
  return (
    <ChoiceButton
      label="Přidat vozidlo"
      icon={<Plus size={18} />}
      choices={[
        {
          label: "Zadat ručně",
          icon: <Plus size={18} />,
          action: () => edit("vehicles"),
        },
        {
          label: "Nahrát STK",
          icon: <Upload size={18} />,
          action: stk,
        },
      ]}
    />
  );
}
