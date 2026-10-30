import {
  Children,
  Fragment,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useId,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactElement,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Inbox,
  X,
  Search,
  ChevronDown,
} from "lucide-react";
import { z } from "zod";
import { DomainError } from "../domain/rules";
import { normalize } from "../lib/format";

export function Button({
  children,
  primary = false,
  danger = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: React.Ref<HTMLButtonElement>;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`btn ${primary ? "primary" : ""} ${danger ? "danger" : ""} ${props.className || ""}`}
    >
      {children}
    </button>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={"notice " + (error ? "error" : "")}
      role={error ? "alert" : undefined}
    >
      {children}
    </div>
  );
}
const tones: Record<string, string> = {
  "V provozu": "green",
  Aktivní: "green",
  Potvrzena: "green",
  Uzavřena: "gray",
  Uzavřená: "gray",
  Spárováno: "green",
  Vyřešeno: "green",
  Vyřešena: "green",
  Dokončená: "green",
  Splněno: "green",
  Vhodné: "green",
  Nevhodné: "red",
  Pozastavený: "red",
  Odstaveno: "red",
  Rozdíl: "red",
  "Vyžaduje řešení": "red",
  failed: "red",
  upload_failed: "red",
  Probíhá: "blue",
  "V servisu": "blue",
  "Řeší se": "blue",
  Přiřazená: "blue",
  processing: "blue",
};
const labels: Record<string, string> = {
  not_configured: "Služba není připojena",
  not_required: "Bez extrakce",
  stored: "Soubor uložen",
  uploading: "Ukládání",
  upload_failed: "Uložení selhalo",
  queued: "Čeká na zpracování",
  processing: "Zpracovává se",
  completed: "Zpracováno",
  incomplete: "Chybí údaje",
  failed: "Zpracování selhalo",
  sending: "Odesílá se",
  sent: "Odesláno",
  skipped_no_recipient: "Vynecháno — bez řidiče",
};
export function Badge({ value }: { value: string }) {
  return (
    <span className={"badge " + (tones[value] || "amber")}>
      {labels[value] || value}
    </span>
  );
}
export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="actions">{actions}</div>
    </div>
  );
}
export function Panel({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      {title && (
        <div className="panel-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}
export function Empty({
  title = "Zatím tu nejsou žádné záznamy",
  text = "Začněte přidáním prvního záznamu.",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={32} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Tabs({
  items,
  base,
  selected,
}: {
  items: [string, string][];
  base: string;
  selected?: string;
}) {
  const location = useLocation();
  return (
    <nav className="tabs" aria-label="Části detailu">
      {items.map(([id, label]) => (
        <Link
          key={id}
          to={`${base}/${id}`}
          state={location.state}
          aria-current={
            selected === id || (!selected && items[0][0] === id)
              ? "page"
              : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function Back({ to, children }: { to: string; children: ReactNode }) {
  const location = useLocation();
  const candidate: unknown = location.state?.returnTo;
  const target =
    typeof candidate === "string" &&
    candidate.startsWith("/") &&
    !candidate.startsWith("//")
      ? candidate
      : to;
  return (
    <Link className="back" to={target} state={location.state}>
      <ArrowLeft size={16} />
      {children}
    </Link>
  );
}
export function DataGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="data-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "Není doloženo"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  dirty = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dirty?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const draftFocus = useRef<HTMLElement | null>(null);
  const [confirm, setConfirm] = useState(false);
  const close = () => {
    if (dirty) {
      if (!confirm)
        draftFocus.current = document.activeElement as HTMLElement | null;
      setConfirm(true);
    } else onClose();
  };
  useEffect(() => {
    if (confirm) confirmationRef.current?.querySelector("button")?.focus();
    else draftFocus.current?.focus();
  }, [confirm]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="dialog-title"
    >
      <header className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <Button aria-label="Zavřít dialog" onClick={close}>
          <X size={20} />
        </Button>
      </header>
      {confirm && (
        <div className="dialog-body" ref={confirmationRef}>
          <Notice>Formulář obsahuje neuložené změny. Zahodit je?</Notice>
          <div className="actions">
            <Button onClick={() => setConfirm(false)}>
              Pokračovat v úpravách
            </Button>
            <Button danger onClick={onClose}>
              Zahodit změny
            </Button>
          </div>
        </div>
      )}
      <div hidden={confirm}>{children}</div>
    </dialog>
  );
}
export type FieldSpec = {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "money"
    | "date"
    | "datetime"
    | "email"
    | "tel"
    | "select"
    | "checkbox";
  required?: boolean;
  options?: [string, string][];
  help?: string;
  initial?: string;
  readOnly?: boolean;
};
export function Form({
  fields,
  initial = {},
  onSubmit,
  children,
  submit = "Uložit",
  danger = false,
  onDirty,
}: {
  fields: FieldSpec[];
  initial?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  children?: ReactNode;
  submit?: string;
  danger?: boolean;
  onDirty?: (dirty: boolean) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const hasField = (key: string) =>
    fields.some((f) => f.key === key) ||
    !!formRef.current?.elements.namedItem(key);
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setErrors({});
    setFailure("");
    const invalid = nativeFieldErrors(e.currentTarget);
    const fd = new FormData(e.currentTarget);
    const values: Record<string, unknown> = {};
    try {
      for (const f of fields) {
        const raw = String(fd.get(f.key) ?? "");
        if (f.type === "checkbox") values[f.key] = fd.has(f.key);
        else if (f.type === "number" || f.type === "money") {
          const n = raw.trim()
            ? Number(raw.replace(/\s/g, "").replace(",", "."))
            : null;
          if (n !== null && !Number.isFinite(n))
            invalid[f.key] = "Zadejte platné číslo.";
          values[f.key] =
            f.type === "money" && n !== null ? Math.round(n * 100) : n;
        } else values[f.key] = raw;
      }
      if (Object.keys(invalid).length) {
        setErrors(invalid);
        return;
      }
      setPending(true);
      await onSubmit(values);
      onDirty?.(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const next: Record<string, string> = {};
        const general: string[] = [];
        for (const issue of error.issues) {
          const key = issue.path.join(".");
          if (hasField(key)) next[key] = issue.message;
          else general.push(issue.message);
        }
        setErrors(next);
        if (general.length) setFailure(general.join(" · "));
      } else if (error instanceof DomainError && error.fieldErrors) {
        const next: Record<string, string> = {};
        const general: string[] = [];
        for (const [key, message] of Object.entries(error.fieldErrors)) {
          if (hasField(key)) next[key] = message;
          else general.push(message);
        }
        setErrors(next);
        if (general.length || !Object.keys(next).length)
          setFailure(general.join(" · ") || error.message);
      } else if (
        error instanceof DomainError &&
        error.field &&
        hasField(error.field)
      )
        setErrors({ [error.field]: error.message });
      else
        setFailure(error instanceof Error ? error.message : "Operace selhala.");
    } finally {
      setPending(false);
    }
  }
  return (
    <FieldErrors.Provider value={errors}>
      <form
        ref={formRef}
        noValidate
        onSubmit={save}
        onChange={() => onDirty?.(true)}
      >
        <div className="form-grid">
          {fields.map((f) => {
            const value = initial[f.key] ?? f.initial ?? "";
            const id = "field-" + f.key;
            const common = {
              name: f.key,
              id,
              required: f.required,
              readOnly: f.readOnly,
              "aria-invalid": !!errors[f.key],
              "aria-describedby":
                f.help || errors[f.key] ? id + "-hint" : undefined,
            };
            return (
              <div
                key={f.key}
                className={"field " + (f.type === "textarea" ? "full" : "")}
              >
                <label htmlFor={id}>
                  {f.label}
                  {f.required && (
                    <span className="required-mark" aria-hidden="true">
                      {" "}
                      *
                    </span>
                  )}
                </label>
                {f.type === "select" ? (
                  <select {...common} defaultValue={String(value)}>
                    {!f.required && (
                      <option value="">Není doloženo / žádné</option>
                    )}
                    {f.required && (
                      <option value="" disabled>
                        Vyberte…
                      </option>
                    )}
                    {f.options?.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea {...common} defaultValue={String(value)} />
                ) : f.type === "checkbox" ? (
                  <input {...common} type="checkbox" defaultChecked={!!value} />
                ) : (
                  <input
                    {...common}
                    type={
                      f.type === "number" || f.type === "money"
                        ? "text"
                        : f.type === "datetime"
                          ? "datetime-local"
                          : f.type || "text"
                    }
                    inputMode={
                      f.type === "number" || f.type === "money"
                        ? "decimal"
                        : undefined
                    }
                    defaultValue={
                      f.type === "money" && typeof value === "number"
                        ? value / 100
                        : String(value)
                    }
                  />
                )}
                <small
                  id={id + "-hint"}
                  className={errors[f.key] ? "field-error" : ""}
                >
                  {errors[f.key] || f.help}
                </small>
              </div>
            );
          })}
        </div>
        {children}
        {failure && <Notice error>{failure}</Notice>}
        <div className="form-actions">
          <Button
            primary={!danger}
            danger={danger}
            type="submit"
            disabled={pending}
          >
            {pending ? "Ukládání…" : submit}
          </Button>
        </div>
      </form>
    </FieldErrors.Provider>
  );
}
export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number | null;
};
export type Filter<T> = {
  key: string;
  label: string;
  options: [string, string][];
  value: (row: T) => string;
};
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  path,
  search,
  filters = [],
  emptyText = "Žádný odpovídající záznam",
  prefix = "",
  toolbarActions,
}: {
  rows: T[];
  columns: Column<T>[];
  path?: (row: T) => string;
  search: (row: T) => string;
  filters?: Filter<T>[];
  emptyText?: string;
  prefix?: string;
  toolbarActions?: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [q, setQuery] = useState<string>(
    () => location.state?.tableQueries?.[prefix] || "",
  );
  const returnState = {
    returnTo: location.pathname + location.search,
    tableQueries: { ...location.state?.tableQueries, [prefix]: q },
  };
  const sort = params.get(prefix + "sort") || columns[0].key,
    desc = params.get(prefix + "desc") === "1";
  const page = Math.max(1, Number(params.get(prefix + "page")) || 1);
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (key === "q") {
      setQuery(value);
      next.delete(prefix + "q");
      next.delete(prefix + "page");
      setParams(next, { replace: true, state: location.state });
      return;
    }
    if (value) next.set(prefix + key, value);
    else next.delete(prefix + key);
    if (key !== "page") next.delete(prefix + "page");
    setParams(next, { replace: true });
  };
  const selected = columns.find((c) => c.key === sort);
  const filtered = rows
    .filter(
      (r) =>
        (!q || normalize(search(r)).includes(normalize(q))) &&
        filters.every(
          (f) =>
            !params.get(prefix + f.key) ||
            f.value(r) === params.get(prefix + f.key),
        ),
    )
    .sort((a, b) => {
      const av = selected?.sort?.(a) ?? "",
        bv = selected?.sort?.(b) ?? "";
      return (
        (typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "cs")) * (desc ? -1 : 1)
      );
    });
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  return (
    <div className="table-container">
      <div className="toolbar">
        <label className="table-search">
          <Search size={17} />
          <input
            aria-label="Hledat v seznamu"
            placeholder="Hledat v seznamu…"
            value={q}
            onChange={(e) => change("q", e.target.value)}
          />
        </label>
        {filters.map((f) => (
          <select
            key={f.key}
            aria-label={f.label}
            value={params.get(prefix + f.key) || ""}
            onChange={(e) => change(f.key, e.target.value)}
          >
            <option value="">{f.label}</option>
            {f.options.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        ))}
        <span className="muted">{filtered.length} výsledků</span>
        {toolbarActions && (
          <div className="toolbar-actions">{toolbarActions}</div>
        )}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    sort === c.key
                      ? desc
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                >
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set(prefix + "sort", c.key);
                        next.set(
                          prefix + "desc",
                          sort === c.key && !desc ? "1" : "0",
                        );
                        setParams(next, { replace: true });
                      }}
                    >
                      {c.label}
                      {sort === c.key ? (desc ? " ↓" : " ↑") : ""}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice((current - 1) * 10, current * 10).map((row) => (
              <tr
                key={row.id}
                className={path ? "clickable" : ""}
                onClick={(e) => {
                  if (
                    !path ||
                    e.ctrlKey ||
                    e.metaKey ||
                    e.shiftKey ||
                    e.button !== 0 ||
                    window.getSelection()?.toString() ||
                    (e.target as HTMLElement).closest(
                      "a,button,input,select,label",
                    )
                  )
                    return;
                  navigate(path(row), { state: returnState });
                }}
              >
                {columns.map((c, i) => (
                  <td key={c.key}>
                    {i === 0 && path ? (
                      <Link
                        className="row-link"
                        to={path(row)}
                        state={returnState}
                      >
                        {c.render(row)}
                      </Link>
                    ) : (
                      c.render(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="table-empty">
          <Empty
            title={rows.length ? emptyText : "Evidence je zatím prázdná"}
            text={
              rows.length
                ? "Změňte hledání nebo filtry."
                : "Uložené záznamy se zobrazí zde."
            }
          />
        </div>
      )}
      <div className="pagination">
        <span>
          {filtered.length
            ? `${(current - 1) * 10 + 1}–${Math.min(current * 10, filtered.length)} z ${filtered.length}`
            : "0 záznamů"}
        </span>
        <div className="actions">
          <Button
            aria-label="Předchozí stránka"
            disabled={current === 1}
            onClick={() => change("page", String(current - 1))}
          >
            <ArrowLeft size={17} />
          </Button>
          <span>
            {current} / {pages}
          </span>
          <Button
            aria-label="Další stránka"
            disabled={current === pages}
            onClick={() => change("page", String(current + 1))}
          >
            <ArrowRight size={17} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function HistorySwitch({
  checked,
  onChange,
  label = "Zobrazit i historické",
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}) {
  return (
    <label className="history-switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
export function ViewToggle({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string; icon?: ReactNode }[];
}) {
  return (
    <div className="view-toggle" role="group" aria-label="Zobrazení">
      {items.map((i) => (
        <button
          key={i.value}
          type="button"
          aria-pressed={value === i.value}
          onClick={() => onChange(i.value)}
        >
          {i.icon}
          {i.label}
        </button>
      ))}
    </div>
  );
}

const FieldErrors = createContext<Record<string, string>>({});
export function Field({
  children,
  error: explicitError,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { error?: string }) {
  const errors = useContext(FieldErrors);
  const generated = useId();
  let name = generated;
  const controls = Children.map(children, (child) => {
    if (
      !isValidElement(child) ||
      !["input", "select", "textarea"].includes(String(child.type))
    )
      return child;
    const el = child as ReactElement<InputHTMLAttributes<HTMLInputElement>>;
    name = el.props.name || generated;
    return (
      <Fragment key={name}>
        {el.props.required && (
          <span className="required-mark" aria-hidden="true">
            {" "}
            *
          </span>
        )}
        {cloneElement(el, {
          name,
          id: el.props.id || generated,
          "aria-invalid": !!(explicitError || errors[name]),
          "aria-describedby":
            explicitError || errors[name]
              ? `${generated}-error`
              : el.props["aria-describedby"],
        })}
      </Fragment>
    );
  });
  return (
    <label {...props} className={`${props.className || ""} validated-field`}>
      {controls}
      {(explicitError || errors[name]) && (
        <small id={`${generated}-error`} className="field-error" role="alert">
          {explicitError || errors[name]}
        </small>
      )}
    </label>
  );
}
function nativeFieldErrors(form: HTMLFormElement) {
  const errors: Record<string, string> = {};
  for (const el of Array.from(form.elements)) {
    if (
      !(
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      ) ||
      !el.name ||
      el.disabled ||
      el.validity.valid
    )
      continue;
    const label =
      el.labels?.[0]?.textContent?.split("*")[0]?.trim() || "Toto pole";
    errors[el.name] = el.validity.valueMissing
      ? `Vyplňte pole „${label}“.`
      : el.validity.typeMismatch
        ? "Zadejte platnou e-mailovou adresu."
        : el.validity.rangeUnderflow
          ? `Zadejte hodnotu alespoň ${el instanceof HTMLInputElement ? el.min : ""}.`
          : "Zadejte platnou hodnotu.";
  }
  return errors;
}
export function ValidatedForm({
  onSubmit,
  children,
  ...props
}: React.ComponentProps<"form">) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <FieldErrors.Provider value={errors}>
      <form
        {...props}
        noValidate
        onSubmit={(e) => {
          const next = nativeFieldErrors(e.currentTarget);
          setErrors(next);
          if (Object.keys(next).length) e.preventDefault();
          else onSubmit?.(e);
        }}
      >
        {children}
      </form>
    </FieldErrors.Provider>
  );
}

export function FilePicker({
  files,
  onChange,
  label = "Vybrat soubory",
  accept = "application/pdf,image/jpeg,image/png",
  multiple = true,
  camera = false,
  name = "files",
  error,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
  accept?: string;
  multiple?: boolean;
  camera?: boolean;
  name?: string;
  error?: string;
}) {
  const errors = useContext(FieldErrors);
  const id = useId();
  const failure = error || errors[name];
  const ref = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  return (
    <div className="file-picker">
      <div
        className="upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const next = Array.from(e.dataTransfer.files);
          onChange(multiple ? next : next.slice(0, 1));
        }}
      >
        <span>Přetáhněte sem soubor nebo jej vyberte.</span>
        <Button onClick={() => ref.current?.click()}>{label}</Button>
        <input
          ref={ref}
          name={name}
          aria-invalid={!!failure}
          aria-describedby={failure ? `${id}-error` : undefined}
          className="visually-hidden"
          aria-label={label}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => onChange(Array.from(e.target.files || []))}
        />
      </div>
      {camera && (
        <>
          <Button onClick={() => cameraRef.current?.click()}>
            Vyfotit účtenku
          </Button>
          <input
            className="visually-hidden"
            ref={cameraRef}
            type="file"
            aria-label="Vyfotit účtenku"
            accept="image/jpeg,image/png"
            capture="environment"
            onChange={(e) => onChange(Array.from(e.target.files || []))}
          />
        </>
      )}
      {failure && (
        <small className="field-error" id={`${id}-error`} role="alert">
          {failure}
        </small>
      )}
      {!!files.length && (
        <ul className="selected-files">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              {f.name} · {Math.ceil(f.size / 1024)} kB
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type AddChoice = { label: string; action: () => void; icon?: ReactNode };
export function ChoiceButton({
  label,
  icon,
  choices,
}: {
  label: string;
  icon?: ReactNode;
  choices: AddChoice[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="choice-button" ref={ref}>
      <Button
        ref={trigger}
        primary
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {icon}
        {label}
        <ChevronDown size={17} />
      </Button>
      {open && (
        <div id={id} className="choice-menu" role="group" aria-label={label}>
          {choices.map((c) => (
            <Button
              key={c.label}
              onClick={() => {
                setOpen(false);
                c.action();
              }}
            >
              {c.icon}
              {c.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
