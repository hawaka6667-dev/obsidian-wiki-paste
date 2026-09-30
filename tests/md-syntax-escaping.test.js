// @machine:
// Tests minimal escaping for active Markdown and Obsidian syntax.
// Covers reference cases, source preservation, pipes, line endings, and indentation.
const assert = require("node:assert/strict");
const test = require("node:test");
const { getEscapeCases, restoreMarkdownEscapes } = require("./escape-case-provider");
const { escapeMarkdownSyntax, escapeObsidianSyntax } = require("../src/md-syntax-escaping.ts");

test("keeps plain-text reference cases collision-free without pinning fx spelling", () => {
  const examples = getEscapeCases("plainText");
  assert.ok(examples.length > 0);

  for (const { input, referenceFx } of examples) {
    const output = escapeMarkdownSyntax(input);
    assert.equal(restoreMarkdownEscapes(output), input, input);
    assert.equal(escapeObsidianSyntax(output), output, `output still collides with Obsidian syntax: ${input}`);
    assert.equal(escapeObsidianSyntax(referenceFx), referenceFx, `fx reference still collides with Obsidian syntax: ${input}`);
  }
});

test("escapes Obsidian footnote and wikilink openers in plain text", () => {
  assert.equal(escapeMarkdownSyntax("[^abc]"), String.raw`\[^abc]`);
  assert.equal(escapeMarkdownSyntax("[[Page]]"), String.raw`\[\[Page]]`);
});

test("preserves ordinary text, pipes, and line endings", () => {
  assert.equal(escapeMarkdownSyntax("plain words, a|b and punctuation."), "plain words, a|b and punctuation.");
  assert.equal(escapeMarkdownSyntax("- first\r\n# second\n"), String.raw`\- first` + "\r\n" + String.raw`\# second` + "\n");
});

test("preserves syntax escaping after converting code indentation to spaces", () => {
  const fourSpaces = "&nbsp;".repeat(4);

  assert.equal(escapeMarkdownSyntax("    **bold**"), fourSpaces + String.raw`\*\*bold**`);
  assert.equal(escapeMarkdownSyntax("    - item"), fourSpaces + String.raw`\- item`);
  assert.equal(escapeMarkdownSyntax("\t# heading"), fourSpaces + String.raw`\# heading`);
});

test("doubles existing slashes before escapable punctuation without changing the visible source", () => {
  assert.equal(escapeMarkdownSyntax(String.raw`\.`), String.raw`\\.`);
  assert.equal(escapeMarkdownSyntax(String.raw`\\#tag`), String.raw`\\\\\#tag`);
  assert.equal(escapeMarkdownSyntax("%%unclosed"), "%%unclosed");
});