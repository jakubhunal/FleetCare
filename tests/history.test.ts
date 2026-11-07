import { expect, it } from "vitest";
import { historyRows, historyParams } from "../src/lib/history";

it("shows current rows by default and current plus historical when enabled", () => {
  const rows = [
    { id: "current", historical: false },
    { id: "old", historical: true },
  ];
  const old = (r: (typeof rows)[number]) => r.historical;
  expect(historyRows(rows, false, old).map((r) => r.id)).toEqual(["current"]);
  expect(historyRows(rows, true, old).map((r) => r.id)).toEqual([
    "current",
    "old",
  ]);
});
it("resets only the affected table page and preserves filters on either toggle", () => {
  const params = new URLSearchParams("doc.page=3&other.page=2&doc.type=STK");
  const enabled = historyParams(params, "doc.", true);
  expect(enabled.get("doc.history")).toBe("1");
  expect(enabled.has("doc.page")).toBe(false);
  expect(enabled.get("other.page")).toBe("2");
  expect(enabled.get("doc.type")).toBe("STK");
  enabled.set("doc.page", "2");
  const disabled = historyParams(enabled, "doc.", false);
  expect(disabled.has("doc.history")).toBe(false);
  expect(disabled.has("doc.page")).toBe(false);
  expect(params.get("doc.page")).toBe("3");
});
