export function documentTarget(target: string, parent: string) {
  if (!target.startsWith("/documents/")) return target;
  const url = new URL(target, "https://fleetcare.invalid");
  url.searchParams.set("from", parent);
  return url.pathname + url.search;
}
export function documentParent(search: string, fallback: string) {
  const from = new URLSearchParams(search).get("from");
  return from &&
    /^\/(vehicles|drivers|orders|expenses|fuels|faults|statements|transactions|my|costs|deadlines)(\/|\?|$)/.test(
      from,
    )
    ? from
    : fallback;
}
