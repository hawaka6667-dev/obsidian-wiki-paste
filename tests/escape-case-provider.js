// @machine:
// Loads JSON escape cases and provides normalized fixtures to test suites.
// Restores Markdown punctuation escapes for source-preservation assertions.
const examples = require("./escape-cases.json");

function getEscapeCases(group) {
  const cases = examples[group];
  if (!Array.isArray(cases)) {
    throw new Error(`Unknown escape case group: ${group}`);
  }

  return cases.map(({ x, fx, expected }) => ({ input: x, referenceFx: fx, expectedOutput: expected }));
}

function restoreMarkdownEscapes(text) {
  let output = "";

  for (let index = 0; index < text.length;) {
    if (text[index] !== "\\") {
      output += text[index];
      index += 1;
      continue;
    }

    let runEnd = index + 1;
    while (text[runEnd] === "\\") {
      runEnd += 1;
    }

    const next = text[runEnd];
    if (next === undefined || !isMarkdownEscapable(next)) {
      output += "\\".repeat(runEnd - index);
      index = runEnd;
      continue;
    }

    output += "\\".repeat(Math.floor((runEnd - index) / 2));
    output += next;
    index = runEnd + 1;
  }

  return output;
}

function isMarkdownEscapable(character) {
  const codePoint = character.charCodeAt(0);
  return (codePoint >= 33 && codePoint <= 47)
    || (codePoint >= 58 && codePoint <= 64)
    || (codePoint >= 91 && codePoint <= 96)
    || (codePoint >= 123 && codePoint <= 126);
}

module.exports = { getEscapeCases, restoreMarkdownEscapes };
