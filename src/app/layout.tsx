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
  Search,
  Menu,
  ArrowUpRight,
  FileText,
  Receipt,
  ClipboardList,
} from "lucide-react";
import { useFleet } from "./context";
import { Button, Dialog, Empty, Notice } from "../components/ui";
import { roles, type Actor } from "../domain/models";
import { config } from "./config";
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
  ["/my/vehicle", "Moje vozidlo", Truck],
  ["/my/orders", "Moje zakázky", Package],
  ["/my/trips", "Moje jízdy", Route],
  ["/my/fault", "Nahlásit závadu", Wrench],
  ["/my/fuel", "Zadat tankování", Receipt],
  ["/my/requests", "Moje požadavky", ClipboardList],
  ["/my/documents", "Moje dokumenty", FileText],
] as const;
export function Layout({
  children,
  onActor,
}: {
  children: React.ReactNode;
  onActor: (actor: Actor) => void;
}) {
  const { actor, repo, show } = useFleet();
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
  const selected = entries.find(([path]) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path),
  );
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
        <div className="workspace-label">
          <span className="workspace-monogram">FC</span>
          <div>
            <strong>Správa vozového parku</strong>
            <small>Společný pracovní prostor</small>
          </div>
        </div>
        <div className="nav-label">
          {actor.role === "Řidič" ? "MŮJ PRACOVNÍ DEN" : "SPRÁVA DOPRAVY"}
        </div>
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
        <div className="sidebar-bottom">
          <span className="environment-pill">
            <i />
            {repo.mode === "local"
              ? "Lokální pracovní prostor"
              : "Připojené API"}
          </span>
          <p>
            Jasný přehled.
            <br />
            Klidnější den na cestách.
          </p>
          <span className="sidebar-version">FleetCare · 1.0</span>
        </div>
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
          <div className="breadcrumb">
            <span>Pracovní prostor</span>
            <b>/</b>
            <strong>{selected?.[1] || "Detail"}</strong>
          </div>
          <button
            className="global-search-trigger"
            onClick={() => show(<GlobalSearch />)}
            aria-label="Globální hledání"
          >
            <Search size={18} />
            <span>Hledat v aplikaci…</span>
            <kbd>↵</kbd>
          </button>
          <label className="role-select">
            <span>Zobrazit jako</span>
            <select
              aria-label="Zobrazit jako"
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
        </header>
        {actor.role === "Řidič" && (
          <div className="actor-bar">
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
          </div>
        )}
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
function GlobalSearch() {
  const { repo, actor, close } = useFleet();
  const [query, setQuery] = useState(""),
    [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(timer);
  }, [query]);
  const result = useQuery({
    queryKey: ["search", repo.mode, actor.role, actor.driverId, debounced],
    queryFn: ({ signal }) => repo.search(actor, debounced, signal),
    enabled: !!debounced.trim(),
    retry: false,
  });
  const groups = Array.from(new Set(result.data?.map((r) => r.type) || []));
  return (
    <Dialog title="Hledat v pracovním prostoru" onClose={close}>
      <div className="dialog-body">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDebounced(query);
          }}
          className="search-form"
        >
          <Search size={21} />
          <input
            autoFocus
            aria-label="Globální hledání"
            placeholder="SPZ, VIN, řidič, zakázka, závada…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            onClick={() => {
              setQuery("");
              setDebounced("");
            }}
          >
            Vymazat
          </Button>
        </form>
        {!query ? (
          <p className="muted">
            Hledání pracuje napříč oblastmi dostupnými vašemu kontextu.
          </p>
        ) : result.isFetching ? (
          <p role="status">Vyhledávání…</p>
        ) : result.error ? (
          <Notice error>{result.error.message}</Notice>
        ) : result.data?.length ? (
          groups.map((group) => (
            <section key={group}>
              <h3 className="section-title">{group}</h3>
              {result.data
                .filter((r) => r.type === group)
                .map((r) => (
                  <Link
                    className="search-result"
                    key={r.id}
                    to={r.path}
                    onClick={close}
                  >
                    <div>
                      <strong>{r.title}</strong>
                      <small>{r.subtitle}</small>
                    </div>
                    <ArrowUpRight size={17} />
                  </Link>
                ))}
            </section>
          ))
        ) : (
          <Empty
            title="Žádné výsledky"
            text="Zkuste jiný výraz nebo zkontrolujte zvolený kontext."
          />
        )}
      </div>
    </Dialog>
  );
}
