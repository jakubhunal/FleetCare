import { Plus, Upload } from "lucide-react";
import { useFleet } from "../app/context";
import { Button, Dialog, ChoiceButton } from "../components/ui";
import { useEditors } from "./editors";
import { useUpload } from "./documents";

export function useAddVehicle() {
  const { show, close } = useFleet();
  const edit = useEditors();
  const upload = useUpload();
  return () =>
    show(
      <Dialog title="Přidat vozidlo" onClose={close}>
        <div className="dialog-body">
          <p>Zvolte způsob přidání vozidla.</p>
          <div className="actions">
            <Button primary onClick={() => edit("vehicles")}>
              <Plus size={18} /> Zadat ručně
            </Button>
            <Button onClick={() => upload("intake", "new", undefined, "STK")}>
              <Upload size={18} /> Nahrát STK
            </Button>
          </div>
        </div>
      </Dialog>,
    );
}

export function AddVehicleButton() {
  const edit = useEditors();
  const upload = useUpload();
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
          action: () => upload("intake", "new", undefined, "STK"),
        },
      ]}
    />
  );
}
