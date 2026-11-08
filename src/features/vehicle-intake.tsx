import { Plus, Upload } from "lucide-react";
import { useFleet } from "../app/context";
import { Button, Dialog, ChoiceButton } from "../components/ui";
import { useEditors } from "./editors";
import { useUpload } from "./documents";

/**
 * Přidat vozidlo → Nahrát STK: the protocol is stored first (as an intake
 * document keyed by the future vehicle id), then the vehicle form opens with
 * the STK validity prefilled. Saving the vehicle attaches the protocol to it
 * on the server (see the vehicles branch of applyCommand).
 */
function useStkIntake() {
  const edit = useEditors();
  const upload = useUpload();
  return () => {
    const vehicleId = crypto.randomUUID();
    upload("intake", vehicleId, undefined, "STK", ({ validUntil }) =>
      edit(
        "vehicles",
        undefined,
        { id: vehicleId, ...(validUntil ? { stkUntil: validUntil } : {}) },
        false,
        "STK je nahraná. Doplňte údaje vozidla podle protokolu a uložte; protokol se k vozidlu připojí automaticky.",
      ),
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
