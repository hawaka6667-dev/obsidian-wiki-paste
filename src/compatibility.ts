type EscapeMarker = (index: number) => void;

function markFirstCapture(line: string, mark: EscapeMarker, pattern: RegExp): void {
  for (const match of line.matchAll(pattern)) {
    mark(match.index + match[0].indexOf(match[1]));
  }
}

function collectBlockSyntax(line: string, mark: EscapeMarker): void {
  markFirstCapture(line, mark, /^ {0,3}(#{1,6})(?=\s|$)/gm);
  markFirstCapture(line, mark, /^ {0,3}(>)(?=\s|$)/gm);
  markFirstCapture(line, mark, /^ {0,3}([-+*])(?=\s|$)/gm);

  for (const match of line.matchAll(/^ {0,3}\d{1,9}([.)])(?=\s)/gm)) {
    mark(match.index + match[0].indexOf(match[1]));
  }

  for (const match of line.matchAll(/^ {0,3}(`{3,}|~{3,})/gm)) {
    const start = match.index + match[0].indexOf(match[1]);
    for (let offset = 0; offset < match[1].length; offset += 1) {
      mark(start + offset);
    }
  }

  for (const match of line.matchAll(/^ {0,3}(?:(?:\* *){3,}|(?:- *){3,}|(?:_ *){3,})$/gm)) {
    mark(match.index + match[0].search(/[\*_\-]/));
  }
}

interface ParsedInlineLink {
  start: number;
  end: number;
  labelStart: number;
  labelEnd: number;
}

interface InlineLinkRange extends ParsedInlineLink {
  supported: boolean;
}

function parseInlineLink(line: string, start: number): ParsedInlineLink | undefined {
  let bracketDepth = 0;
  let labelEnd = -1;

  for (let index = start; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === "[") {
      bracketDepth += 1;
    } else if (character === "]") {
      bracketDepth -= 1;
      if (bracketDepth === 0) {
        labelEnd = index;
        break;
      }
    }
  }

  if (labelEnd === -1 || line[labelEnd + 1] !== "(") {
    return undefined;
  }

  let parenthesisDepth = 1;
  for (let index = labelEnd + 2; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === "(") {
      parenthesisDepth += 1;
    } else if (character === ")") {
      parenthesisDepth -= 1;
      if (parenthesisDepth === 0) {
        return { start, end: index + 1, labelStart: start + 1, labelEnd };
      }
    }
  }

  return undefined;
}

function isSupportedRegexLinkLabel(label: string): boolean {
  return label === String.raw`\.`
    || /^\[(?:\^)?(?:[A-Za-z]+|\d+|[A-Za-z]-[A-Za-z]|\d-\d)\]$/.test(label);
}

function collectRegexLinkSyntax(line: string, mark: EscapeMarker): InlineLinkRange[] {
  const inlineLinks: InlineLinkRange[] = [];

  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "[") {
      continue;
    }

    const link = parseInlineLink(line, index);
    if (!link) {
      continue;
    }

    const label = line.slice(link.labelStart, link.labelEnd);
    const supported = isSupportedRegexLinkLabel(label);
    inlineLinks.push({ ...link, supported });

    if (supported) {
      if (label.startsWith("[")) {
        mark(link.labelStart);
        mark(link.labelEnd - 1);
      }
    }
    index = link.end - 1;
  }

  return inlineLinks;
}

function collectLinkSyntax(line: string, mark: EscapeMarker, inlineLinks: InlineLinkRange[]): void {

  for (const match of line.matchAll(/\[\[[^\]\r\n]+\]\]|\[\^[^\]\r\n]+\]/g)) {
    if (inlineLinks.some((link) => link.start === match.index)) {
      continue;
    }

    const opening = match.index + match[0].indexOf("[");
    mark(opening);
    if (match[0].startsWith("[[")) {
      mark(opening + 1);
    }
  }

  for (const match of line.matchAll(/!?\[[^\]\r\n]+\](?:\([^\)\r\n]*\)|\[[^\]\r\n]*\])/g)) {
    const linkStart = match.index + match[0].indexOf("[");
    if (inlineLinks.some((link) => link.start === linkStart)) {
      continue;
    }

    const opening = match.index + match[0].indexOf("[");
    mark(opening);

    const referenceOpening = match[0].indexOf("[", match[0].indexOf("]") + 1);
    if (referenceOpening !== -1) {
      mark(match.index + referenceOpening);
    }
  }

  if (/^ {0,3}\[[^\]\r\n]+\]:\s*\S+/.test(line)) {
    mark(line.indexOf("["));
  }

  for (const match of line.matchAll(/(?:^|>)\s*\[!/g)) {
    mark(match.index + match[0].lastIndexOf("["));
  }
}

function isDelimiterBoundary(character: string | undefined): boolean {
  return character === undefined || /[\s\p{P}\p{S}]/u.test(character);
}

function collectPairedDelimiterSyntax(line: string, marker: string, mark: EscapeMarker): void {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const runs = [...line.matchAll(new RegExp(`${escapedMarker}+`, "g"))];

  for (let index = 0; index < runs.length; index += 1) {
    const opening = runs[index];
    const delimiter = opening[0];
    const openingIndex = opening.index;
    const previous = line[openingIndex - 1];
    const next = line[openingIndex + delimiter.length];
    const isAsteriskRun = marker === "*";
    const canOpen = isDelimiterBoundary(previous)
      || (isAsteriskRun && delimiter.length >= 3 && next !== undefined && !/\s/.test(next));

    if (!canOpen) {
      continue;
    }

    const matchingIndex = runs.findIndex((candidate, candidateIndex) => {
      if (candidateIndex <= index || candidate[0] !== delimiter) {
        return false;
      }

      return true;
    });

    if (matchingIndex === -1) {
      continue;
    }

    const openingCount = marker === "~" || marker === "=" ? 1 : delimiter.length;
    for (let offset = 0; offset < openingCount; offset += 1) {
      mark(openingIndex + offset);
    }

    const closing = runs[matchingIndex];
    const suffix = line[closing.index + delimiter.length];
    const canClose = isDelimiterBoundary(suffix)
      || (isAsteriskRun && delimiter.length >= 3 && suffix !== undefined && !/\s/.test(suffix));

    if (canClose) {
      const closingCount = marker === "~" || marker === "="
        ? 1
        : delimiter.length >= 2 && delimiter.length < 3 ? 0 : delimiter.length;
      for (let offset = 0; offset < closingCount; offset += 1) {
        mark(closing.index + offset);
      }
    }

    index = matchingIndex;
  }
}

function collectEmphasisSyntax(line: string, mark: EscapeMarker): void {
  collectPairedDelimiterSyntax(line, "*", mark);
  collectPairedDelimiterSyntax(line, "_", mark);
  collectPairedDelimiterSyntax(line, "~", mark);
  collectPairedDelimiterSyntax(line, "=", mark);
}

function collectCodeSyntax(line: string, mark: EscapeMarker): void {
  const runs = [...line.matchAll(/(`+)/g)];

  for (let index = 0; index < runs.length; index += 1) {
    const closingIndex = runs.findIndex((candidate, candidateIndex) =>
      candidateIndex > index
        && candidate[0].length === runs[index][0].length,
    );

    if (closingIndex === -1) {
      continue;
    }

    for (const runIndex of [index, closingIndex]) {
      for (let offset = 0; offset < runs[runIndex][0].length; offset += 1) {
        mark(runs[runIndex].index + offset);
      }
    }
    index = closingIndex;
  }
}

function collectMathSyntax(line: string, mark: EscapeMarker): void {
  const runs = [...line.matchAll(/(\$+)/g)];

  for (let index = 0; index < runs.length; index += 1) {
    const closingIndex = runs.findIndex((candidate, candidateIndex) =>
      candidateIndex > index && candidate[0].length === runs[index][0].length,
    );

    if (closingIndex !== -1) {
      mark(runs[index].index);
      index = closingIndex;
    }
  }
}

function collectObsidianSyntax(line: string, mark: EscapeMarker): void {
  for (const match of line.matchAll(/\\/g)) {
    const nextCharacter = line[match.index + 1];
    const codePoint = nextCharacter?.charCodeAt(0) ?? 0;
    const isMarkdownEscapablePunctuation = (codePoint >= 33 && codePoint <= 47)
      || (codePoint >= 58 && codePoint <= 64)
      || (codePoint >= 91 && codePoint <= 96)
      || (codePoint >= 123 && codePoint <= 126);

    if (isMarkdownEscapablePunctuation) {
      mark(match.index);
    }
  }

  const comments = [...line.matchAll(/%%/g)];
  for (let index = 0; index + 1 < comments.length; index += 2) {
    mark(comments[index].index);
    mark(comments[index + 1].index);
  }

  for (const match of line.matchAll(/<\/?[A-Za-z][^>\r\n]*>/g)) {
    mark(match.index);
  }

  for (const match of line.matchAll(/(?:^|\s|\\)#(?=[\p{L}\p{N}_/-])/gu)) {
    mark(match.index + match[0].length - 1);
  }

  for (const match of line.matchAll(/(?:^|\s)\^[\w-]+(?=\s*$)/g)) {
    mark(match.index + match[0].length - match[0].trimStart().length);
  }
}

function applyMinimalEscapes(line: string, candidates: Set<number>): string {
  let output = "";

  for (let index = 0; index < line.length; index += 1) {
    if (candidates.has(index)) {
      output += "\\";
    }
    output += line[index];
  }

  return output;
}

function escapeMarkdownLine(line: string, escapeTablePipes: boolean): string {
  const candidates = new Set<number>();
  const mark: EscapeMarker = (index) => candidates.add(index);
  const inlineLinks = collectRegexLinkSyntax(line, mark);

  collectBlockSyntax(line, mark);
  collectLinkSyntax(line, mark, inlineLinks);
  collectEmphasisSyntax(line, mark);
  collectCodeSyntax(line, mark);
  collectMathSyntax(line, mark);
  collectObsidianSyntax(line, mark);

  if (escapeTablePipes) {
    for (const match of line.matchAll(/\|/g)) {
      mark(match.index);
    }
  }

  for (const match of line.matchAll(/\[[^\]]*\]/g)) {
    if (line.slice(0, match.index).trimStart().startsWith(">")) {
      mark(match.index);
    }
  }

  for (const link of inlineLinks) {
    if (link.supported) {
      continue;
    }

    for (const index of candidates) {
      if (index >= link.start && index < link.end) {
        candidates.delete(index);
      }
    }
  }

  return applyMinimalEscapes(line, candidates);
}

function preserveIndentedCodeText(indentation: string): string {
  let column = 0;
  let output = "";

  for (const character of indentation) {
    const width = character === "\t" ? 4 - (column % 4) : 1;
    output += "&nbsp;".repeat(width);
    column += width;
  }

  return output;
}

export function escapeMarkdownSyntax(text: string): string {
  const lines = text.split(/(?<=\n)/);
  const contents = lines.map((line) => line.replace(/\r?\n$/, ""));
  const tableLines = new Set<number>();

  for (let index = 1; index < contents.length; index += 1) {
    if (!/^ {0,3}\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(contents[index])
      || !contents[index - 1].includes("|")) {
      continue;
    }

    let end = index;
    while (end + 1 < contents.length && contents[end + 1].includes("|") && contents[end + 1].trim()) {
      end += 1;
    }

    for (let row = index - 1; row <= end; row += 1) {
      tableLines.add(row);
    }
  }

  return lines.map((line, index) => {
    const lineEnding = line.endsWith("\r\n") ? "\r\n" : line.endsWith("\n") ? "\n" : "";
    const content = line.slice(0, line.length - lineEnding.length);
    const indentation = content.match(/^[ \t]*/)?.[0] ?? "";
    let indentationColumns = 0;

    for (const character of indentation) {
      indentationColumns += character === "\t" ? 4 - (indentationColumns % 4) : 1;
    }

    if (indentationColumns >= 4 && indentation.length < content.length) {
      return `${preserveIndentedCodeText(indentation)}${escapeMarkdownLine(content.slice(indentation.length), tableLines.has(index))}${lineEnding}`;
    }

    return `${escapeMarkdownLine(content, tableLines.has(index))}${lineEnding}`;
  }).join("");
}