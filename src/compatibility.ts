function countPrecedingBackslashes(text: string, index: number): number {
  let count = 0;

  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    count += 1;
  }

  return count;
}

function escapeFootnoteReferencesInText(text: string): string {
  return text.replace(/\[\^([^\]\r\n]+)\]/g, (match: string, label: string, offset: number, source: string) => {
    const closingBracket = offset + match.length - 1;
    const openingIsEscaped = countPrecedingBackslashes(source, offset) % 2 === 1;
    const closingIsEscaped = countPrecedingBackslashes(source, closingBracket) % 2 === 1;

    if (openingIsEscaped || closingIsEscaped) {
      return match;
    }

    return `\\[^${label}\\]`;
  });
}

function escapeOutsideInlineCode(text: string): string {
  let output = "";
  let cursor = 0;

  while (cursor < text.length) {
    const opening = text.indexOf("`", cursor);

    if (opening === -1) {
      output += escapeFootnoteReferencesInText(text.slice(cursor));
      break;
    }

    output += escapeFootnoteReferencesInText(text.slice(cursor, opening));
    let openingEnd = opening;

    while (text[openingEnd] === "`") {
      openingEnd += 1;
    }

    const delimiter = text.slice(opening, openingEnd);
    let closing = openingEnd;

    while (closing < text.length) {
      closing = text.indexOf("`", closing);

      if (closing === -1) {
        break;
      }

      let closingEnd = closing;

      while (text[closingEnd] === "`") {
        closingEnd += 1;
      }

      if (closingEnd - closing === delimiter.length) {
        break;
      }

      closing = closingEnd;
    }

    if (closing === -1) {
      output += delimiter;
      cursor = openingEnd;
      continue;
    }

    const closingEnd = closing + delimiter.length;
    output += text.slice(opening, closingEnd);
    cursor = closingEnd;
  }

  return output;
}

export function escapeFootnoteReferences(text: string): string {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
  let output = "";
  let plainText = "";
  let fence: { character: string; length: number } | null = null;

  for (const line of lines) {
    const content = line.replace(/\r?\n$/, "");

    if (fence) {
      output += line;
      const closingFence = content.match(/^ {0,3}(`+|~+)[ \t]*$/);

      if (closingFence && closingFence[1][0] === fence.character && closingFence[1].length >= fence.length) {
        fence = null;
      }

      continue;
    }

    const openingFence = content.match(/^ {0,3}(`{3,}|~{3,})/);

    if (openingFence) {
      output += escapeOutsideInlineCode(plainText);
      plainText = "";
      fence = { character: openingFence[1][0], length: openingFence[1].length };
      output += line;
      continue;
    }

    plainText += line;
  }

  return output + escapeOutsideInlineCode(plainText);
}