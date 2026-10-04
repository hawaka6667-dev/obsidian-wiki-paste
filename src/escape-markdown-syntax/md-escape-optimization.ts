// @machine:
// Applies fresh syntax offsets supplied by md-syntax-escaping.ts on every call.
// Caches no output; minimizes syntax escapes and preserves literal link-label backslashes.
export function optimizeMarkdownEscapes(
  line: string,
  escapeCandidates: ReadonlySet<number>,
  indentationLength: number,
  preserveExistingEscapes = false,
  doubleBackslashCandidates: ReadonlySet<number> = new Set(),
): string {
  if (indentationLength > 0) {
    const indentation = line.slice(0, indentationLength);
    return `${preserveIndentedCodeText(indentation)}${optimizeLineContent(line.slice(indentationLength), escapeCandidates, preserveExistingEscapes, doubleBackslashCandidates)}`;
  }

  return optimizeLineContent(line, escapeCandidates, preserveExistingEscapes, doubleBackslashCandidates);
}

export function isMarkdownEscapablePunctuation(character: string | undefined): boolean {
  if (character === undefined) {
    return true;
  }

  const codePoint = character.charCodeAt(0);
  return (codePoint >= 33 && codePoint <= 47)
    || (codePoint >= 58 && codePoint <= 64)
    || (codePoint >= 91 && codePoint <= 96)
    || (codePoint >= 123 && codePoint <= 126);
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

function optimizeLineContent(
  line: string,
  escapeCandidates: ReadonlySet<number>,
  preserveExistingEscapes: boolean,
  doubleBackslashCandidates: ReadonlySet<number>,
): string {
  let output = "";

  for (let index = 0; index < line.length;) {
    if (line[index] === "\\") {
      let runEnd = index + 1;
      while (line[runEnd] === "\\") {
        runEnd += 1;
      }

      const runLength = runEnd - index;
      if (preserveExistingEscapes) {
        output += "\\".repeat(doubleBackslashCandidates.has(index) ? runLength * 2 : runLength);
      } else {
        output += "\\".repeat(isMarkdownEscapablePunctuation(line[runEnd]) ? runLength * 2 : runLength);
      }
      index = runEnd;
      continue;
    }

    if (escapeCandidates.has(index)) {
      output += "\\";
    }
    output += line[index];
    index += 1;
  }

  return output;
}