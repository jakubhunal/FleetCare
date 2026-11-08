import { expect, it, vi, afterEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import {
  StatementPdfLink,
  statementDocuments,
} from "../src/features/statement-pdf";
import { collections, meta } from "../src/domain/models";
import { fixture } from "./factories";
afterEach(()=>vi.unstubAllGlobals());
it("detail a tabulka sdílejí výběr souborů i navigaci, chybějící soubor je disabled", () => {
  vi.stubGlobal("document", {querySelector:()=>null});
  const s = fixture();
  const doc = collections.documents.parse({
    ...meta("pdf"),
    ownerType: "statement",
    ownerId: "st",
    type: "CCS výpis",
    name: "Výpis.pdf",
    mime: "application/pdf",
    size: 20,
    hash: "test",
    storageKey: "test",
    uploadedAt: "2026-11-08T00:00:00Z",
    fileState: "stored",
    extraction: "not_required",
  });
  s.documents.push(
    { ...doc, id: "deleted", deletedAt: "2026-11-08T00:00:00Z" },
    doc,
    { ...doc, id: "older" },
  );
  expect(statementDocuments(s, "st").map((d) => d.id)).toEqual([
    "pdf",
    "older",
  ]);
  expect(statementDocuments(s, "missing")).toEqual([]);
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/costs/statements"] },
      createElement(StatementPdfLink, { document: doc, iconOnly: true }),
    ),
  );
  expect(html).toContain("/documents/pdf?from=%2Fcosts%2Fstatements");
  expect(html).toContain('aria-label="Otevřít PDF"');
  expect(renderToStaticMarkup(createElement(StatementPdfLink, {}))).toContain(
    "disabled",
  );
});
