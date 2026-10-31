import {
  createContext,
  useEffect,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Actor, Workspace } from "../domain/models";
import type { Command, Repository, UploadInput } from "../data/contracts";
import { Button, Dialog, Notice } from "../components/ui";
type ContextValue = {
  s: Workspace;
  actor: Actor;
  repo: Repository;
  run: (command: Command, key?: string) => Promise<void>;
  upload: (input: UploadInput) => Promise<void>;
  show: (content: ReactNode) => void;
  close: () => void;
  toast: (message: string) => void;
};
export const TOAST_DURATION_MS = 7000;
const Context = createContext<ContextValue | null>(null);
export const useFleet = () => {
  const value = useContext(Context);
  if (!value) throw new Error("Chybí aplikační kontext.");
  return value;
};
export function WorkspaceProvider({
  actor,
  repo,
  children,
}: {
  actor: Actor;
  repo: Repository;
  children: ReactNode;
}) {
  const client = useQueryClient(),
    [dialog, setDialog] = useState<ReactNode>(null),
    [message, setMessageState] = useState<{ text: string } | null>(null);
  const setMessage = (text: string) => setMessageState(text ? { text } : null);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessageState(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message]);
  const query = useQuery({
    queryKey: ["workspace", repo.mode, actor.role, actor.driverId],
    queryFn: ({ signal }) => repo.read(actor, signal),
    staleTime: 60000,
    retry: false,
  });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["workspace"] });
    await client.invalidateQueries({ queryKey: ["actors"] });
  };
  if (query.isPending)
    return (
      <div className="loading" role="status">
        Načítání pracovního prostoru…
      </div>
    );
  if (query.isError)
    return (
      <div className="content">
        <Notice error>{query.error.message}</Notice>
        <Button onClick={() => void query.refetch()}>Zkusit znovu</Button>
      </div>
    );
  const value: ContextValue = {
    s: query.data,
    actor,
    repo,
    show: setDialog,
    close: () => setDialog(null),
    toast: setMessage,
    run: async (command, key = crypto.randomUUID()) => {
      await repo.execute(actor, { command, idempotencyKey: key });
      if (command.type === "document.delete")
        client.removeQueries({ queryKey: ["file"] });
      await refresh();
      setMessage("Změna byla uložena.");
    },
    upload: async (input) => {
      await repo.upload(actor, input);
      await refresh();
      setMessage("Soubor byl uložen. Stav zpracování najdete u dokumentu.");
    },
  };
  return (
    <Context.Provider value={value}>
      {children}
      {dialog}
      {message && (
        <div className="toast" role="status">
          {message.text}
          <Button aria-label="Zavřít zprávu" onClick={() => setMessage("")}>
            ×
          </Button>
        </div>
      )}
    </Context.Provider>
  );
}
export function Confirm({
  title,
  description,
  action,
  onDone,
}: {
  title: string;
  description: string;
  action: () => Promise<void>;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog title={title} onClose={onDone}>
      <div className="dialog-body">
        <p>{description}</p>
        {error && <Notice error>{error}</Notice>}
        <div className="form-actions">
          <Button onClick={onDone}>Zrušit</Button>
          <Button
            danger
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await action();
                onDone();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Akce selhala.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Ukládání…" : title}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
