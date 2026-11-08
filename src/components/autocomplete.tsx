import { useId, useState } from "react";
import { normalize } from "../lib/format";
export type AutocompleteOption = {
  value: string;
  label: string;
  search: string;
};
export function autocompleteMatches(
  options: AutocompleteOption[],
  query: string,
  words = false,
) {
  const key = normalize(query);
  return options.filter((o) =>
    words
      ? o.search.split(/\s+/).some((word) => normalize(word).startsWith(key))
      : normalize(o.search).startsWith(key),
  );
}
export function Autocomplete({
  label,
  options,
  value,
  onChange,
  words = false,
  disabled = false,
}: {
  label: string;
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  words?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = autocompleteMatches(options, query ?? "", words);
  const choose = (option: AutocompleteOption) => {
    onChange(option.value);
    setQuery(null);
    setOpen(false);
  };
  return (
    <div className="autocomplete">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        autoComplete="off"
        disabled={disabled}
        value={query ?? options.find((o) => o.value === value)?.label ?? ""}
        aria-expanded={open}
        aria-controls={id + "-list"}
        aria-autocomplete="list"
        aria-activedescendant={
          open && matches[active] ? id + "-" + active : undefined
        }
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("");
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            e.preventDefault();
            e.stopPropagation();
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              Math.max(
                0,
                Math.min(
                  matches.length - 1,
                  open ? i + (e.key === "ArrowDown" ? 1 : -1) : 0,
                ),
              ),
            );
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            if (matches[active]) choose(matches[active]);
          }
          if (e.key === "Tab") setOpen(false);
        }}
      />
      {open && (
        <ul id={id + "-list"} role="listbox" aria-label={label}>
          {matches.map((option, i) => (
            <li
              id={id + "-" + i}
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={active === i ? "active" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(option)}
            >
              {option.label}
            </li>
          ))}
          {!matches.length && <li role="presentation">Nic nenalezeno</li>}
        </ul>
      )}
    </div>
  );
}
