import { expect, it } from "vitest";
import { autocompleteMatches } from "../src/components/autocomplete";
it("SPZ hledá od začátku bez mezer a velikosti písmen", () => {
  const options = [
    { value: "a", label: "AB 123", search: "AB 123" },
    { value: "b", label: "1DE 1001", search: "1DE 1001" },
  ];
  expect(autocompleteMatches(options, "ab").map((o) => o.value)).toEqual(["a"]);
  expect(autocompleteMatches(options, "1de").map((o) => o.value)).toEqual([
    "b",
  ]);
  expect(autocompleteMatches(options, "DE")).toEqual([]);
});
it("jméno hledá od začátku slov bez diakritiky", () => {
  const options = [
    { value: "a", label: "Jiří Šťastný", search: "Jiří Šťastný" },
  ];
  expect(autocompleteMatches(options, "stast", true)).toHaveLength(1);
  expect(autocompleteMatches(options, "xxx", true)).toHaveLength(0);
});
