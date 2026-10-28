import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid,
  Truck,
  Users,
  Package,
  Route,
  Wrench,
  Wallet,
  CalendarDays,
  Settings,
  BarChart3,
  Menu,
  FileText,
  Receipt,
  ClipboardList,
} from "lucide-react";
import { useFleet } from "./context";
import { Button } from "../components/ui";
import { roles, type Actor } from "../domain/models";
import { config } from "./config";
import { HeaderSearch } from "./header-search";
const management = [
  ["/", "Přehled", LayoutGrid],
  ["/vehicles", "Vozidla", Truck],
  ["/drivers", "Řidiči", Users],
  ["/orders", "Zakázky", Package],
  ["/trips", "Přehled jízd", Route],
  ["/faults", "Servis a závady", Wrench],
  ["/costs", "Náklady a CCS", Wallet],
  ["/deadlines", "Termíny a upozornění", CalendarDays],
  ["/settings", "Nastavení", Settings],
] as const;
const driverNav = [
  ["/my/vehicle", "Přehled", LayoutGrid],
  ["/my/orders", "Moje zakázky", Package],
  ["/my/trips", "Moje jízdy", Route],
  ["/my/fault", "Nahlásit závadu", Wrench],
  ["/my/fuel", "Zadat tankování", Receipt],
  ["/my/requests", "Moje úkoly", ClipboardList],
  ["/my/documents", "Moje dokumenty", FileText],
] as const;
export function Layout({
  children,
  onActor,
}: {
  children: React.ReactNode;
  onActor: (actor: Actor) => void;
}) {
  const { actor, repo } = useFleet();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const identities = useQuery({
    queryKey: ["actors", repo.mode],
    queryFn: ({ signal }) => repo.identities(signal),
    retry: false,
    staleTime: 60000,
  });
  const entries = actor.role === "Řidič" ? driverNav : management;
  return (
    <>
      <a
        href="#main"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Přejít k obsahu
      </a>
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <Link
          className="brand"
          to={actor.role === "Řidič" ? "/my/vehicle" : "/"}
        >
          <span className="brand-mark">
            <Truck size={23} />
          </span>
          FleetCare<span className="brand-period">.</span>
        </Link>
        <nav aria-label="Hlavní navigace">
          {entries.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
          {actor.role === "Vedení" && (
            <NavLink to="/reports">
              <BarChart3 size={19} />
              Reporty
            </NavLink>
          )}
        </nav>
      </aside>
      {menu && (
        <button
          className="menu-shade"
          aria-label="Zavřít navigaci"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <Button
            className="mobile-menu"
            aria-label="Otevřít navigaci"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu size={21} />
          </Button>
          <HeaderSearch
            key={`${actor.role}:${actor.driverId}:${location.pathname}`}
          />
        </header>
        <div className="actor-bar">
          <label className="role-select">
            <select
              aria-label="Role"
              value={actor.role}
              onChange={(e) =>
                onActor({
                  role: e.target.value as Actor["role"],
                  driverId: null,
                })
              }
            >
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          {actor.role === "Řidič" && (
            <>
              <label>
                Řidič
                <select
                  aria-label="Vybraný řidič"
                  value={actor.driverId || ""}
                  onChange={(e) =>
                    onActor({ ...actor, driverId: e.target.value || null })
                  }
                >
                  <option value="">Zvolte existujícího řidiče…</option>
                  {identities.data?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              {identities.error && (
                <span role="alert">{identities.error.message}</span>
              )}
            </>
          )}
        </div>
        <div className={"mode-banner " + (config.label ? "demo" : "")}>
          {config.label ||
            (repo.mode === "local"
              ? "Lokální režim — data jsou uložena v tomto prohlížeči"
              : "API režim — data z nakonfigurovaného rozhraní")}
        </div>
        <main className="content" id="main" tabIndex={-1}>
          {children}
          <footer>
            <span>FleetCare © {new Date().getFullYear()}</span>
            {import.meta.env.VITE_BUILD_SHA && (
              <a
                href={`https://github.com/jakubhunal/FleetCare/commit/${import.meta.env.VITE_BUILD_SHA}`}
                target="_blank"
                rel="noreferrer"
                title="Zdrojový commit nasazené verze"
              >
                Verze {import.meta.env.VITE_BUILD_SHA.slice(0, 7)}
              </a>
            )}
            <span>{actor.role} · přepínač kontextu bez přihlášení</span>
          </footer>
        </main>
      </div>
    </>
  );
}
