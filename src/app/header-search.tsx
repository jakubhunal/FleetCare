import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search, X } from "lucide-react";
import { useFleet } from "./context";
import { Button, Notice } from "../components/ui";

export function HeaderSearch() {
  const { repo, actor } = useFleet();
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const resultsId = useId();
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);
  const result = useQuery({
    queryKey: ["search", repo.mode, actor.role, actor.driverId, settled],
    queryFn: ({ signal }) => repo.search(actor, settled, signal),
    enabled: open && !!settled,
    retry: false,
  });
  const pending = query.trim() !== settled || result.isFetching;
  const groups = Array.from(new Set(result.data?.map((r) => r.type) || []));
  return (
    <div
      className="header-search"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          input.current?.focus();
          setOpen(false);
        }
        if (open && ["ArrowDown", "ArrowUp"].includes(event.key)) {
          const links = Array.from(
            root.current?.querySelectorAll<HTMLAnchorElement>(
              ".header-search-results a",
            ) || [],
          );
          if (!links.length) return;
          const index = links.indexOf(
            document.activeElement as HTMLAnchorElement,
          );
          const next =
            event.key === "ArrowDown"
              ? (index + 1) % links.length
              : index < 0
                ? links.length - 1
                : (index - 1 + links.length) % links.length;
          event.preventDefault();
          links[next].focus();
        }
      }}
    >
      <form
        className="header-search-form"
        role="search"
        aria-label="Hledání v aplikaci"
        onSubmit={(event) => {
          event.preventDefault();
          setOpen(true);
          if (settled && settled === query.trim()) void result.refetch();
          else setSettled(query.trim());
        }}
      >
        <input
          ref={input}
          type="search"
          aria-label="Hledat v aplikaci"
          placeholder="Hledat v aplikaci…"
          aria-controls={resultsId}
          autoComplete="off"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (!event.target.value) setSettled("");
          }}
        />
        {query.length > 0 && (
          <Button
            className="search-clear"
            aria-label="Vymazat hledaný text"
            title="Vymazat hledaný text"
            onClick={() => {
              setQuery("");
              setSettled("");
              input.current?.focus();
            }}
          >
            <X size={18} />
          </Button>
        )}
        <Button
          primary
          type="submit"
          className="search-submit"
          aria-label="Vyhledat"
          aria-controls={resultsId}
          aria-expanded={open}
          title="Vyhledat"
        >
          <Search size={20} />
        </Button>
      </form>
      {open && (
        <div
          id={resultsId}
          className="header-search-results"
          role="region"
          aria-label="Výsledky hledání"
        >
          {!query.trim() ? (
            <p className="search-status">
              Hledejte podle SPZ, VIN, řidiče, zakázky nebo závady.
            </p>
          ) : pending ? (
            <p className="search-status" role="status">
              Vyhledávání…
            </p>
          ) : result.error ? (
            <Notice error>{result.error.message}</Notice>
          ) : result.data?.length ? (
            <>
              <p className="search-status" role="status">
                Nalezeno: {result.data.length}
              </p>
              {groups.map((group) => (
                <section key={group}>
                  <h2 className="search-group-title">{group}</h2>
                  {result.data
                    .filter((r) => r.type === group)
                    .map((r) => (
                      <Link
                        className="search-result"
                        key={`${r.type}:${r.id}`}
                        to={r.path}
                        onClick={() => setOpen(false)}
                      >
                        <div>
                          <strong>{r.title}</strong>
                          <small>{r.subtitle}</small>
                        </div>
                        <ArrowUpRight size={17} />
                      </Link>
                    ))}
                </section>
              ))}
            </>
          ) : (
            <p className="search-status" role="status">
              Žádné výsledky. Zkuste jiný výraz.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
