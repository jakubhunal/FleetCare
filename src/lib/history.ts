import { useLocation, useSearchParams } from "react-router";

export function historyRows<T>(
  rows: T[],
  includeHistory: boolean,
  historical: (row: T) => boolean,
): T[] {
  return includeHistory ? rows : rows.filter((row) => !historical(row));
}
export function historyParams(
  params: URLSearchParams,
  prefix: string,
  include: boolean,
) {
  const next = new URLSearchParams(params);
  if (include) next.set(prefix + "history", "1");
  else next.delete(prefix + "history");
  next.delete(prefix + "page");
  return next;
}
/** Shared data filter and URL state; counts/paging use these same rows in DataTable. */
export function useHistory<T>(
  rows: T[],
  historical: (row: T) => boolean,
  prefix = "",
) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const included = params.get(prefix + "history") === "1";
  return {
    rows: historyRows(rows, included, historical),
    historical: included,
    setHistorical: (include: boolean) =>
      setParams(historyParams(params, prefix, include), {
        replace: true,
        state: location.state,
      }),
  };
}
