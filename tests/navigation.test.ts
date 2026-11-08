import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { Back } from "../src/components/ui";
import { documentTarget, documentParent } from "../src/lib/navigation";
it("pevný skutečný odkaz nepřepíše kontext předchozí stránky", () => {
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      {
        initialEntries: [
          { pathname: "/orders/o1", state: { returnTo: "/drivers/d1" } },
        ],
      },
      createElement(Back, { to: "/orders", children: "Zakázky" }),
    ),
  );
  expect(html).toContain('href="/orders"');
});
it("kontext dokumentu je v URL a neplatný má deterministický fallback", () => {
  const target = documentTarget("/documents/d", "/vehicles/v/documents?page=2");
  expect(documentParent(target.slice(target.indexOf("?")), "/vehicles")).toBe(
    "/vehicles/v/documents?page=2",
  );
  for (const from of ["https://evil.test", "//evil.test", "/documents/d"])
    expect(
      documentParent("?from=" + encodeURIComponent(from), "/vehicles"),
    ).toBe("/vehicles");
});
