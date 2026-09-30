// @machine:
// Scans each plain-text input for active Markdown and Obsidian syntax.
// Post-conversion rules preserve Markdown links while escaping Obsidian syntax in their labels.
// Sends fresh offsets to md-escape-optimization.ts and preserves source line endings.
// 这里只维护和优化转换规则，规则要求是提炼出对应ob符号的那种基本逻辑，以后还会提供更多case
import { isMarkdownEscapablePunctuation, optimizeMarkdownEscapes } from "./md-escape-optimization";

type EscapeMarker = (index: number) => void;

interface DelimiterRun {
  start: number;
  length: number;
}

function markRun(mark: EscapeMarker, start: number, length: number): void {
  for (let offset = 0; offset < length; offset += 1) {
    mark(start + offset);
  }
}

function collectRuns(line: string, marker: string): DelimiterRun[] {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...line.matchAll(new RegExp(`${escapedMarker}+`, "g"))]
    .map((match) => ({ start: match.index, length: match[0].length }));
}

function isWhitespace(character: string | undefined): boolean {
  return character === undefined || /\s/u.test(character);
}

function collectEmphasisSyntax(line: string, marker: string, mark: EscapeMarker): void {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordBoundaryBefore = marker === "_" ? "(?<![\\p{L}\\p{N}])" : "";
  const wordBoundaryAfter = marker === "_" ? "(?![\\p{L}\\p{N}])" : "";
  const completeRun = `(?!${escapedMarker})`;
  const pattern = new RegExp(
    `${wordBoundaryBefore}(${escapedMarker}+)${completeRun}(?!\\s).*?(?<!\\s)\\1${completeRun}${wordBoundaryAfter}`,
    "gu",
  );

  for (const match of line.matchAll(pattern)) {
    markRun(mark, match.index, match[1].length);
  }
}

function collectPairedMarkerSyntax(line: string, marker: string, mark: EscapeMarker, escapeOpeningLength: (length: number) => number): void {
  const runs = collectRuns(line, marker);

  for (let index = 0; index < runs.length; index += 1) {
    const opening = runs[index];
    if (isWhitespace(line[opening.start + opening.length])) {
      continue;
    }

    const closingIndex = runs.findIndex((candidate, candidateIndex) =>
      candidateIndex > index
        && candidate.length === opening.length
        && !isWhitespace(line[candidate.start - 1]),
    );
    if (closingIndex === -1) {
      continue;
    }

    markRun(mark, opening.start, escapeOpeningLength(opening.length));
    index = closingIndex;
  }
}

function collectBlockSyntax(line: string, mark: EscapeMarker): void {
  for (const match of line.matchAll(/^ {0,3}(#{1,6})(?=\s|$)/gm)) {
    mark(match.index + match[0].indexOf(match[1]));
  }

  for (const match of line.matchAll(/^ {0,3}(>)(?=\s|\[!)/gm)) {
    mark(match.index + match[0].indexOf(match[1]));
  }

  for (const match of line.matchAll(/^ {0,3}([-+*])(?=\s)/gm)) {
    mark(match.index + match[0].indexOf(match[1]));
  }

  for (const match of line.matchAll(/^ {0,3}\d{1,9}([.)])(?=\s)/gm)) {
    mark(match.index + match[0].indexOf(match[1]));
  }

  for (const match of line.matchAll(/^ {0,3}(`{3,}|~{3,})/gm)) {
    const start = match.index + match[0].indexOf(match[1]);
    markRun(mark, start, match[1].length);
  }

  const thematicBreak = /^ {0,3}(?:(?:\* *){3,}|(?:- *){3,}|(?:_ *){3,})(?:<br\s*\/?\s*>)?\s*$/i.exec(line);
  if (thematicBreak) {
    mark(thematicBreak.index + thematicBreak[0].search(/[\*_-]/));
  }
}

function collectReferenceLinkSyntax(line: string, mark: EscapeMarker): void {
  for (const match of line.matchAll(/!?\[[^\]\r\n]+\]\[[^\]\r\n]*\]/g)) {
    const firstOpening = match.index + match[0].indexOf("[");
    const secondOpening = match.index + match[0].indexOf("[", match[0].indexOf("]") + 1);
    mark(firstOpening);
    if (secondOpening !== -1) {
      mark(secondOpening);
    }
  }
}

function collectInlineCodeSyntax(line: string, mark: EscapeMarker): void {
  const runs = collectRuns(line, "`");

  for (let index = 0; index < runs.length; index += 1) {
    const opening = runs[index];
    const closingIndex = runs.findIndex((candidate, candidateIndex) =>
      candidateIndex > index && candidate.length === opening.length,
    );
    if (closingIndex === -1) {
      continue;
    }

    markRun(mark, opening.start, opening.length);
    index = closingIndex;
  }
}

function collectObsidianSyntax(line: string, mark: EscapeMarker, linkLabels: LinkLabelRange[] = []): void {
  for (const match of line.matchAll(/\[\^[^\]\r\n]+\]/g)) {
    if (!linkLabels.some((range) => match.index < range.end && match.index + match[0].length > range.start)) {
      mark(match.index);
    }
  }

  for (const match of line.matchAll(/\[\[[^\]\r\n]+\]\]/g)) {
    if (!linkLabels.some((range) => match.index < range.end && match.index + match[0].length > range.start)) {
      mark(match.index);
      mark(match.index + 1);
    }
  }

  for (const match of line.matchAll(/(?:^|\s|\\)#(?=[\p{L}\p{N}_/-])/gu)) {
    mark(match.index + match[0].length - 1);
  }

  for (const match of line.matchAll(/(?:^|\s)\^[\w-]+(?=\s*$)/g)) {
    mark(match.index + match[0].length - match[0].trimStart().length);
  }

  const commentMarkers = [...line.matchAll(/%%/g)];
  for (let index = 0; index + 1 < commentMarkers.length; index += 2) {
    mark(commentMarkers[index].index);
  }

  for (const match of line.matchAll(/<\/?[A-Za-z][^>\r\n]*>/g)) {
    mark(match.index);
  }
}

interface LinkLabelRange {
  start: number;
  end: number;
}

function isInsideRange(index: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some((range) => index >= range.start && index < range.end);
}

function collectMarkdownLinkLabels(line: string, codeRanges: Array<{ start: number; end: number }>): LinkLabelRange[] {
  const labels: LinkLabelRange[] = [];

  for (let start = 0; start < line.length; start += 1) {
    if (line[start] !== "[" || isEscapedByBackslash(line, start) || isInsideRange(start, codeRanges)) {
      continue;
    }

    let depth = 1;
    for (let index = start + 1; index < line.length; index += 1) {
      if (isInsideRange(index, codeRanges) || isEscapedByBackslash(line, index)) {
        continue;
      }

      if (line[index] === "[") {
        depth += 1;
      } else if (line[index] === "]") {
        depth -= 1;
        if (depth === 0) {
          if (line[index + 1] === "(") {
            labels.push({ start: start + 1, end: index });
          }
          start = index;
          break;
        }
      }
    }
  }

  return labels;
}

function collectLinkLabelSyntax(
  line: string,
  labels: LinkLabelRange[],
  codeRanges: Array<{ start: number; end: number }>,
  mark: EscapeMarker,
): Set<number> {
  const doubleBackslashCandidates = new Set<number>();

  for (const label of labels) {
    for (let index = label.start; index < label.end; index += 1) {
      if ((line[index] === "[" || line[index] === "]")
        && !isEscapedByBackslash(line, index)
        && !isInsideRange(index, codeRanges)) {
        mark(index);
      }

      if (line[index] !== "\\" || isInsideRange(index, codeRanges)) {
        continue;
      }

      let runEnd = index + 1;
      while (line[runEnd] === "\\") {
        runEnd += 1;
      }

      const punctuation = line[runEnd];
      if (runEnd - index === 1
        && punctuation !== undefined
        && punctuation !== "["
        && punctuation !== "]"
        && isMarkdownEscapablePunctuation(punctuation)) {
        doubleBackslashCandidates.add(index);
      }
      index = runEnd - 1;
    }
  }

  return doubleBackslashCandidates;
}

function isMarkdownTableSeparator(line: string): boolean {
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.length > 0 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function findMarkdownTableLines(lines: string[]): Set<number> {
  const tableLines = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    if (!isMarkdownTableSeparator(lines[index])) {
      continue;
    }

    let firstLine = index;
    while (firstLine > 0 && lines[firstLine - 1].includes("|")) {
      firstLine -= 1;
    }

    let lastLine = index;
    while (lastLine + 1 < lines.length && lines[lastLine + 1].includes("|")) {
      lastLine += 1;
    }

    for (let tableLine = firstLine; tableLine <= lastLine; tableLine += 1) {
      tableLines.add(tableLine);
    }
  }

  return tableLines;
}

function collectInlineCodeRanges(line: string): Array<{ start: number; end: number }> {
  const runs = collectRuns(line, "`");
  const ranges: Array<{ start: number; end: number }> = [];

  for (let index = 0; index < runs.length; index += 1) {
    const opening = runs[index];
    const closingIndex = runs.findIndex((candidate, candidateIndex) =>
      candidateIndex > index && candidate.length === opening.length,
    );
    if (closingIndex === -1) {
      continue;
    }

    ranges.push({ start: opening.start, end: runs[closingIndex].start + runs[closingIndex].length });
    index = closingIndex;
  }

  return ranges;
}

function isEscapedByBackslash(line: string, index: number): boolean {
  let precedingSlashes = 0;
  for (let preceding = index - 1; preceding >= 0 && line[preceding] === "\\"; preceding -= 1) {
    precedingSlashes += 1;
  }
  return precedingSlashes % 2 === 1;
}

export function escapeObsidianSyntax(text: string): string {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const contentLines = lines.map((line) => line.replace(/\r?\n$/, ""));
  const markdownTableLines = findMarkdownTableLines(contentLines);
  let activeFence: { marker: string; length: number } | undefined;

  return lines.map((line, index) => {
    const lineEnding = line.endsWith("\r\n") ? "\r\n" : line.endsWith("\n") ? "\n" : "";
    const content = line.slice(0, line.length - lineEnding.length);

    if (activeFence) {
      const closingFence = new RegExp(`^ {0,3}${activeFence.marker}{${activeFence.length},}\\s*$`);
      if (closingFence.test(content)) {
        activeFence = undefined;
      }
      return line;
    }

    const openingFence = /^ {0,3}(`{3,}|~{3,})/.exec(content);
    if (openingFence) {
      activeFence = { marker: openingFence[1][0], length: openingFence[1].length };
      return line;
    }

    if (markdownTableLines.has(index) || getSyntaxContent(content).indentationLength > 0) {
      return line;
    }

    const syntaxContent = getSyntaxContent(content);
    const escapeCandidates = new Set<number>();
    const codeRanges = collectInlineCodeRanges(syntaxContent.content);
    const linkLabels = collectMarkdownLinkLabels(syntaxContent.content, codeRanges);
    const mark: EscapeMarker = (offset) => {
      const insideInlineCode = isInsideRange(offset, codeRanges);
      if (!insideInlineCode && !isEscapedByBackslash(syntaxContent.content, offset)) {
        escapeCandidates.add(offset);
      }
    };
    const doubleBackslashCandidates = collectLinkLabelSyntax(syntaxContent.content, linkLabels, codeRanges, mark);
    collectObsidianSyntax(syntaxContent.content, mark, linkLabels);

    return `${optimizeMarkdownEscapes(content, escapeCandidates, syntaxContent.indentationLength, true, doubleBackslashCandidates)}${lineEnding}`;
  }).join("");
}

function collectSyntaxEscapes(line: string): Set<number> {
  const candidates = new Set<number>();
  const mark: EscapeMarker = (index) => candidates.add(index);

  collectBlockSyntax(line, mark);
  collectReferenceLinkSyntax(line, mark);
  collectEmphasisSyntax(line, "*", mark);
  collectEmphasisSyntax(line, "_", mark);
  collectPairedMarkerSyntax(line, "~", mark, () => 1);
  collectPairedMarkerSyntax(line, "=", mark, () => 1);
  collectPairedMarkerSyntax(line, "$", mark, (length) => length);
  collectInlineCodeSyntax(line, mark);
  collectObsidianSyntax(line, mark);

  return candidates;
}

function getSyntaxContent(line: string): { content: string; indentationLength: number } {
  const indentation = line.match(/^[ \t]*/)?.[0] ?? "";
  let indentationColumns = 0;
  for (const character of indentation) {
    indentationColumns += character === "\t" ? 4 - (indentationColumns % 4) : 1;
  }

  if (indentationColumns >= 4 && indentation.length < line.length) {
    return { content: line.slice(indentation.length), indentationLength: indentation.length };
  }

  return { content: line, indentationLength: 0 };
}

export function escapeMarkdownSyntax(text: string): string {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];

  return lines.map((line) => {
    const lineEnding = line.endsWith("\r\n") ? "\r\n" : line.endsWith("\n") ? "\n" : "";
    const content = line.slice(0, line.length - lineEnding.length);
    const syntaxContent = getSyntaxContent(content);
    const escapeCandidates = collectSyntaxEscapes(syntaxContent.content);
    return `${optimizeMarkdownEscapes(content, escapeCandidates, syntaxContent.indentationLength)}${lineEnding}`;
  }).join("");
}
