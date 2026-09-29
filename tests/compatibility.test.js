const assert = require("node:assert/strict");
const test = require("node:test");
const { escapeMarkdownSyntax } = require("../src/compatibility.ts");

test("matches the requested minimal fx output for Obsidian Markdown syntax", () => {
  const examples = [
    ["[^abc]", "\\[^abc]"],
    ["# Heading", "\\# Heading"],
    ["- item", "\\- item"],
    ["1. item", "1\\. item"],
    ["[[Page]]", "\\[\\[Page]]"],
    ["**bold**", "\\*\\*bold**"],
    ["~~strike~~", "\\~~strike\\~~"],
    ["==mark==", "\\==mark\\=="],
    ["> [!note]", "\\> \\[!note]"],
    ["$x^2$", "\\$x^2$"],
    ["<span>x</span>", "\\<span>x\\</span>"],
    ["\\.", "\\\\."],
  ];

  for (const [input, expected] of examples) {
    assert.equal(escapeMarkdownSyntax(input), expected, input);
  }
});

test("leaves non-syntax punctuation and content delimiters unchanged", () => {
  assert.equal(escapeMarkdownSyntax("Keep commas, colons: and periods."), "Keep commas, colons: and periods.");
  assert.equal(escapeMarkdownSyntax("a|b"), "a|b");
  assert.equal(escapeMarkdownSyntax("**bold_text**"), "\\*\\*bold_text**");
});

test("doubles literal backslashes before escaping Markdown syntax", () => {
  assert.equal(escapeMarkdownSyntax(String.raw`\.`), String.raw`\\.`);
  assert.equal(escapeMarkdownSyntax(String.raw`\#tag`), String.raw`\\\#tag`);
  assert.equal(escapeMarkdownSyntax(String.raw`\\#tag`), String.raw`\\\\\#tag`);
});

test("does not mistake closing delimiters for later opening delimiters", () => {
  assert.equal(escapeMarkdownSyntax("**one** and **two**"), "\\*\\*one** and \\*\\*two**");
  assert.equal(escapeMarkdownSyntax("~~one~~ and ~~two~~"), "\\~~one\\~~ and \\~~two\\~~");
  assert.equal(escapeMarkdownSyntax("==one== and ==two=="), "\\==one\\== and \\==two\\==");
});

test("escapes parser-specific markers and minimizes redundant backslashes", () => {
  const examples = [
    ["`inline code`", "\\`inline code\\`"],
    ["*italic* 3", "\\*italic\\* 3"],
    ["* italic* 3", "\\* italic\\* 3"],
    ["text***text***text text", "text\\*\\*\\*text\\*\\*\\*text text"],
    ["[label][ref]", "\\[label]\\[ref]"],
    ["[ label ][ref ]", "\\[ label ]\\[ref ]"],
    ["_italic_     _3       3  _     3", "\\_italic\\_     \\_3       3  \\_     3"],
    ["__bold__b 3b", "\\_\\_bold__b 3b"],
    ["%%comment%% 3", "\\%%comment\\%% 3"],
    [String.raw`\\#tag`, String.raw`\\\\\#tag`],
  ];

  for (const [input, expected] of examples) {
    assert.equal(escapeMarkdownSyntax(input), expected, input);
  }
});

test("preserves source characters and whitespace while disabling Markdown parsing", () => {
  for (const input of ["- item", "1. item", "> [!note]", "*italic* 3", "---<br>"]) {
    const output = escapeMarkdownSyntax(input);
    assert.equal(output.replaceAll("\\", ""), input, input);
  }
});

test("escapes the five supported regex labels inside inline links", () => {
  const examples = [
    [String.raw`[\.](https://example.test/dot)`, String.raw`[\\.](https://example.test/dot)`],
    ["[[abc]](https://example.test/class)", String.raw`[\[abc\]](https://example.test/class)`],
    ["[[^abc]](https://example.test/negated)", String.raw`[\[^abc\]](https://example.test/negated)`],
    ["[[a-z]](https://example.test/letters)", String.raw`[\[a-z\]](https://example.test/letters)`],
    ["[[0-9]](https://example.test/digits)", String.raw`[\[0-9\]](https://example.test/digits)`],
  ];

  for (const [input, expected] of examples) {
    assert.equal(escapeMarkdownSyntax(input), expected, input);
  }
});

test("leaves unfilled regex-link cases unchanged", () => {
  const labels = [
    "abc…", "123…", String.raw`\d`, String.raw`\D`, ".", String.raw`\w`, String.raw`\W`,
    "{m}", "{m,n}", "*", "+", "?", String.raw`\s`, String.raw`\S`, "^…$",
    "(…)", "(a(bc))", "(.*)", "(abc|def)",
  ];

  for (const label of labels) {
    const input = `[${label}](https://example.test/regex)`;
    assert.equal(escapeMarkdownSyntax(input), input, label);
  }
});

test("prevents indentation from becoming a code block while preserving its text", () => {
  assert.equal(escapeMarkdownSyntax("    [^abc]"), "&nbsp;&nbsp;&nbsp;&nbsp;\\[^abc]");
  assert.equal(escapeMarkdownSyntax("\t- item"), "&nbsp;&nbsp;&nbsp;&nbsp;\\- item");
});

test("escapes opening delimiters for fences, frontmatter, comments, tags, and block IDs", () => {
  const input = "---\n```js\nfoo()\n```\n%%comment%% #tag ^block-id";
  const expected = "\\---\n\\`\\`\\`js\nfoo()\n\\`\\`\\`\n\\%%comment\\%% \\#tag \\^block-id";

  assert.equal(escapeMarkdownSyntax(input), expected);
});

test("prevents a Markdown table block from rendering while preserving its cell text", () => {
  const input = "| A | B |\n| --- | --- |\n| x | y |";
  const expected = "\\| A \\| B \\|\n\\| --- \\| --- \\|\n\\| x \\| y \\|";

  assert.equal(escapeMarkdownSyntax(input), expected);
});

test("leaves plain text without Markdown punctuation unchanged", () => {
  assert.equal(escapeMarkdownSyntax("plain words 123"), "plain words 123");
});

test("preserves LF and CRLF line endings without requiring lookbehind", () => {
  assert.equal(escapeMarkdownSyntax("- first\n# second\r\n"), "\\- first\n\\# second\r\n");
  assert.equal(escapeMarkdownSyntax(""), "");
});