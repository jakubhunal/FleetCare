import { StrictMode, Component, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router";
import { createRepository } from "./app/config";
import { WorkspaceProvider } from "./app/context";
import { Layout } from "./app/layout";
import { roles, type Actor } from "./domain/models";
import type { Repository } from "./data/contracts";
import { Empty, Notice } from "./components/ui";
import { Dashboard, DeadlinesPage, DriverWorkspace } from "./features/overview";
import {
  DriverPage,
  DriversPage,
  VehiclePage,
  VehiclesPage,
} from "./features/fleet";
import {
  AssignmentPage,
  FaultPage,
  FaultsPage,
  OrderPage,
  OrdersPage,
  TripPage,
  TripsPage,
} from "./features/operations";
import {
  CostsPage,
  ExpensePage,
  FuelPage,
  StatementPage,
  TransactionPage,
} from "./features/costs";
import { DocumentPage } from "./features/documents";
import { ReportsPage } from "./features/reports";
import { SettingsPage } from "./features/settings";
import "./styles/global.css";
const client = new QueryClient();
const Router =
  import.meta.env.VITE_ROUTER_MODE === "hash" ? HashRouter : BrowserRouter;
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>Pracovní prostor nelze otevřít</h1>
        <Notice error>{this.state.error}</Notice>
        <p>Zkontrolujte konfiguraci a obnovte stránku.</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [repo] = useState<Repository>(() => createRepository());
  const [initial] = useState(readActorPreference);
  const [actor, setActor] = useState<Actor>(initial.actor);
  const [preferenceError, setPreferenceError] = useState(initial.error);
  const navigate = useNavigate();
  const switchActor = async (next: Actor) => {
    await client.cancelQueries();
    client.removeQueries({ queryKey: ["workspace"] });
    client.removeQueries({ queryKey: ["search"] });
    client.removeQueries({ queryKey: ["file"] });
    setActor(next);
    try {
      localStorage.setItem("fleetcare.actor", JSON.stringify(next));
      setPreferenceError("");
    } catch {
      setPreferenceError(
        "Prohlížeč nedovoluje uložit preferenci role. Po obnovení zvolte kontext znovu.",
      );
    }
    navigate(next.role === "Řidič" ? "/my/vehicle" : "/", { replace: true });
  };
  const manager = actor.role !== "Řidič";
  return (
    <WorkspaceProvider
      key={actor.role + actor.driverId}
      actor={actor}
      repo={repo}
    >
      <Layout onActor={(next) => void switchActor(next)}>
        {preferenceError && <Notice>{preferenceError}</Notice>}
        <Routes>
          {manager ? (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/vehicles" element={<VehiclesPage />} />
              <Route path="/vehicles/:id/:tab?" element={<VehiclePage />} />
              <Route path="/drivers" element={<DriversPage />} />
              <Route path="/drivers/:id/:tab?" element={<DriverPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:id/assign" element={<AssignmentPage />} />
              <Route path="/trips" element={<TripsPage />} />
              <Route path="/faults" element={<FaultsPage />} />
              <Route path="/costs/:tab?" element={<CostsPage />} />
              <Route path="/expenses/:id" element={<ExpensePage />} />
              <Route path="/statements/:id" element={<StatementPage />} />
              <Route path="/transactions/:id" element={<TransactionPage />} />
              <Route path="/deadlines" element={<DeadlinesPage />} />
              <Route path="/settings/:tab?" element={<SettingsPage />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Navigate to="/my/vehicle" replace />} />
              <Route path="/my/:tab?" element={<DriverWorkspace />} />
            </>
          )}
          <Route path="/orders/:id/:tab?" element={<OrderPage />} />
          <Route path="/trips/:id" element={<TripPage />} />
          <Route path="/faults/:id" element={<FaultPage />} />
          <Route path="/fuels/:id" element={<FuelPage />} />
          <Route path="/documents/:id" element={<DocumentPage />} />
          <Route
            path="/reports"
            element={
              actor.role === "Vedení" ? (
                <ReportsPage />
              ) : (
                <Empty
                  title="Nedostatečná oprávnění"
                  text="Reporty jsou dostupné pouze vedení."
                />
              )
            }
          />
          <Route
            path="*"
            element={
              <Empty
                title="Stránka není dostupná"
                text="Vyberte některou z dostupných sekcí v navigaci."
              />
            }
          />
        </Routes>
      </Layout>
    </WorkspaceProvider>
  );
}
function readActorPreference(): { actor: Actor; error: string } {
  const fallback: Actor = { role: "Fleet manažer", driverId: null };
  try {
    const raw = localStorage.getItem("fleetcare.actor");
    if (!raw) return { actor: fallback, error: "" };
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "role" in value &&
      roles.includes(value.role as Actor["role"]) &&
      "driverId" in value &&
      (value.driverId === null || typeof value.driverId === "string")
    )
      return { actor: value as Actor, error: "" };
    return {
      actor: fallback,
      error: "Neplatná preference role byla ignorována.",
    };
  } catch {
    return {
      actor: fallback,
      error: "Preference kontextu není dostupná. Zvolte roli v horní liště.",
    };
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <Router>
          <App />
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
