import { Link } from "react-router";
import { useFleet } from "../app/context";
import { Empty, Panel } from "../components/ui";
import { driverTasks } from "../domain/driver-tasks";
import { date } from "../lib/format";

export function DriverTasks() {
  const { s, actor } = useFleet();
  const tasks = driverTasks(s, actor.driverId);
  return (
    <Panel>
      {tasks.length ? (
        tasks.map((task) => (
          <div className="list-item" key={task.id}>
            <div className="driver-task-details">
              <strong>{task.title}</strong>
              <small>
                {s.vehicles.find((v) => v.id === task.vehicleId)?.spz ||
                  "Vozidlo není dostupné"}{" "}
                · {date(task.at, true)}
              </small>
              <p>{task.detail}</p>
              {task.place && <p>{task.place}</p>}
            </div>
            <Link className="btn" to={task.path}>
              {task.action}
            </Link>
          </div>
        ))
      ) : (
        <Empty
          title="Nemáte žádné otevřené úkoly"
          text="Zde se zobrazí jízdy k doplnění a domluvené návštěvy servisu vašich vozidel."
        />
      )}
    </Panel>
  );
}
