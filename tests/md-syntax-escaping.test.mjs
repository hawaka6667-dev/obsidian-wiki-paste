import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeMarkdownSyntax, escapeObsidianSyntax } from "../src/escape-markdown-syntax/md-syntax-escaping.ts";

test("escapes documented plain-text cases", () => {
  assert.equal(escapeMarkdownSyntax("[^abc]"), String.raw`\[^abc]`);
  assert.equal(escapeMarkdownSyntax("~~strike~~"), String.raw`\~~strike\~~`);
  assert.equal(escapeMarkdownSyntax("==mark=="), String.raw`\==mark\==`);
  assert.equal(
    escapeMarkdownSyntax("Regex reference [^abc], ~~strike~~, and ==mark==."),
    String.raw`Regex reference \[^abc], \~~strike\~~, and \==mark\==.`,
  );
  assert.equal(escapeMarkdownSyntax("$x^2$"), String.raw`\$x^2$`);
  assert.equal(escapeMarkdownSyntax("text #tag/sub-tag"), String.raw`text \#tag/sub-tag`);
  assert.equal(escapeMarkdownSyntax("snake_case and _word_"), String.raw`snake_case and \_word_`);
});

test("escapes footnote definitions in plain-text and rich-paste paths", () => {
  const input = "[^ref29]: Footnote source.";
  const expected = String.raw`\[^ref29]: Footnote source.`;

  assert.equal(escapeMarkdownSyntax(input), expected);
  assert.equal(escapeObsidianSyntax(input), expected);
});

test("escapes Obsidian syntax in rich-paste table cells without changing table structure", () => {
  const input = [
    "| Pattern | Meaning |",
    "| --- | --- |",
    "| [.](https://regexone.com/lesson/matching_characters) | [Any Character](https://regexone.com) |",
    "| [\\.](https://regexone.com/lesson/wildcards_dot) | [Period](https://regexone.com) |",
    "| [[abc]](https://regexone.com/lesson/matching_characters) | [Only a, b, or c](https://regexone.com) |",
    "| [[^abc]](https://regexone.com/lesson/excluding_characters) | [Not a, b, nor c](https://regexone.com) |",
    "| [[a-z]](https://regexone.com/lesson/character_ranges) | [Characters a to z](https://regexone.com) |",
    "| [[0-9]](https://regexone.com/lesson/character_ranges) | [Numbers 0 to 9](https://regexone.com) |",
    "| [\\w](https://regexone.com/lesson/matching_characters) | [Any Alphanumeric character](https://regexone.com) |",
    "| [(abc\\|def)](https://regexone.com/lesson/conditionals) | [Matches abc or def](https://regexone.com) |",
  ].join("\n");
  const expected = [
    "| Pattern | Meaning |",
    "| --- | --- |",
    "| [.](https://regexone.com/lesson/matching_characters) | [Any Character](https://regexone.com) |",
    "| [\\\\.](https://regexone.com/lesson/wildcards_dot) | [Period](https://regexone.com) |",
    "| [\\[abc\\]](https://regexone.com/lesson/matching_characters) | [Only a, b, or c](https://regexone.com) |",
    "| [\\[^abc\\]](https://regexone.com/lesson/excluding_characters) | [Not a, b, nor c](https://regexone.com) |",
    "| [\\[a-z\\]](https://regexone.com/lesson/character_ranges) | [Characters a to z](https://regexone.com) |",
    "| [\\[0-9\\]](https://regexone.com/lesson/character_ranges) | [Numbers 0 to 9](https://regexone.com) |",
    "| [\\w](https://regexone.com/lesson/matching_characters) | [Any Alphanumeric character](https://regexone.com) |",
    "| [(abc\\|def)](https://regexone.com/lesson/conditionals) | [Matches abc or def](https://regexone.com) |",
  ].join("\n");

  assert.equal(escapeObsidianSyntax(input), expected);
});