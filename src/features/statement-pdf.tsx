import { FileText } from "lucide-react";
import type { Document, Workspace } from "../domain/models";
import { Button } from "../components/ui";
import { DocumentLink } from "./documents";

export function statementDocuments(s: Workspace, id: string) {
  return s.documents.filter(
    (d) => d.ownerType === "statement" && d.ownerId === id && !d.deletedAt,
  );
}
export function StatementPdfLink({
  document,
  iconOnly = false,
}: {
  document?: Document;
  iconOnly?: boolean;
}) {
  if (!document)
    return (
      <Button disabled aria-label="Otevřít PDF" title="Soubor není k dispozici">
        <FileText size={17} />
      </Button>
    );
  return (
    <DocumentLink
      className="btn"
      to={`/documents/${document.id}`}
      aria-label={iconOnly ? "Otevřít PDF" : undefined}
      title={iconOnly ? "Otevřít PDF" : document.name}
      onClick={(e) => e.stopPropagation()}
    >
      <FileText size={17} />
      {!iconOnly && "Zobrazit výpis (PDF)"}
    </DocumentLink>
  );
}
