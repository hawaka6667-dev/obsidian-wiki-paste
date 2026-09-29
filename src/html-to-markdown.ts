import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

function addEmptyHeadersToTables(document: Document): void {
  for (const table of Array.from(document.querySelectorAll("table"))) {
    if (table.querySelector("thead")) {
      continue;
    }

    const firstRow = table.querySelector("tr");
    if (!firstRow) {
      continue;
    }

    const columnCount = firstRow.querySelectorAll(":scope > th, :scope > td").length;
    if (columnCount === 0) {
      continue;
    }

    const header = document.createElement("thead");
    const headerRow = document.createElement("tr");

    for (let index = 0; index < columnCount; index += 1) {
      headerRow.append(document.createElement("th"));
    }

    header.append(headerRow);
    table.insertBefore(header, table.firstChild);
  }
}

export function htmlToMarkdown(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  addEmptyHeadersToTables(document);

  const converter = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    linkStyle: "inlined",
  });
  converter.use(gfm);

  return converter.turndown(document.body).trim();
}
