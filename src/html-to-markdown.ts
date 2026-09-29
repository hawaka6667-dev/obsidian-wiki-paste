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

function escapeTableCellPipes(content: string): string {
  let output = "";

  for (const character of content) {
    if (character === "|") {
      let precedingBackslashes = 0;
      for (let index = output.length - 1; index >= 0 && output[index] === "\\"; index -= 1) {
        precedingBackslashes += 1;
      }
      if (precedingBackslashes % 2 === 0) {
        output += "\\";
      }
    }
    output += character;
  }

  return output;
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
  converter.addRule("tableCellPipes", {
    filter: ["th", "td"],
    replacement: (content, node) => {
      const cells = node.parentElement?.children;
      const cellIndex = cells ? Array.prototype.indexOf.call(cells, node) : 0;
      const prefix = cellIndex === 0 ? "| " : " ";
      return `${prefix}${escapeTableCellPipes(content)} |`;
    },
  });

  return converter.turndown(document.body).trim();
}
