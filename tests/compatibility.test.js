const assert = require("node:assert/strict");
const test = require("node:test");
const { escapeFootnoteReferences } = require("../src/compatibility.ts");

test("escapes footnote-style references", () => {
  assert.equal(escapeFootnoteReferences("Text [^abc] end"), "Text \\[^abc\\] end");
});

test("leaves unrelated Markdown syntax unchanged", () => {
  const text = "[[abc]] [abc](url) * _ ` ~ == | #";

  assert.equal(escapeFootnoteReferences(text), text);
});

test("does not double-escape an already escaped reference", () => {
  assert.equal(escapeFootnoteReferences("\\[^abc\\]"), "\\[^abc\\]");
});

test("handles multiple references without crossing lines", () => {
  const text = "[^one]\n[^two]";

  assert.equal(escapeFootnoteReferences(text), "\\[^one\\]\n\\[^two\\]");
});

test("leaves references inside inline and fenced code unchanged", () => {
  const text = "`[^inline\ncontinued]`\n```md\n[^fenced]\n```\n[^plain]";
  const expected = "`[^inline\ncontinued]`\n```md\n[^fenced]\n```\n\\[^plain\\]";

  assert.equal(escapeFootnoteReferences(text), expected);
});