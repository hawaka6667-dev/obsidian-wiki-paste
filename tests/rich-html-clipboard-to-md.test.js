// @machine:
// Verifies native HTML paste is allowed to complete before plugin post-processing.
// Confirms Obsidian-specific conflicts are escaped while Markdown formatting and tables remain intact.
const assert = require("node:assert/strict");
const test = require("node:test");
const { handleEditorChange, handleEditorPaste } = require("../src/md-editor-paste-handler.ts");
const { escapeObsidianSyntax } = require("../src/md-syntax-escaping.ts");

function createEditor(initialValue, cursorOffset) {
  const calls = { replacements: [] };
  let value = initialValue;
  let currentCursorOffset = cursorOffset;
  const editor = {
    getValue: () => value,
    getCursor: () => ({ line: 0, ch: currentCursorOffset }),
    posToOffset: (position) => position.ch,
    offsetToPos: (offset) => ({ line: 0, ch: offset }),
    replaceRange: (replacement, from, to) => {
      calls.replacements.push({ replacement, from, to });
      value = value.slice(0, from.ch) + replacement + value.slice(to.ch);
    },
    setValue: (nextValue) => {
      value = nextValue;
      currentCursorOffset = nextValue.length;
    },
  };
  return { editor, calls, getValue: () => value };
}

test("lets Obsidian convert rich HTML, then escapes only Obsidian parser conflicts", () => {
  const initialText = "before ";
  const { editor, calls, getValue } = createEditor(initialText, initialText.length);
  const pasteCalls = { prevented: false, stopped: false };
  const target = { closest: (selector) => selector === ".cm-content" ? {} : null };
  const view = {
    containerEl: { contains: (element) => element === target },
    editor,
  };
  const event = {
    target,
    clipboardData: {
      getData: (type) => type === "text/html" ? "<p>rich content</p>" : "plain content",
    },
    preventDefault: () => { pasteCalls.prevented = true; },
    stopPropagation: () => { pasteCalls.stopped = true; },
  };

  assert.equal(handleEditorPaste(event, view), false);
  assert.equal(pasteCalls.prevented, false);
  assert.equal(pasteCalls.stopped, false);

  editor.setValue("before **bold** and [^abc]");
  assert.equal(handleEditorChange(editor), true);
  assert.equal(getValue(), String.raw`before **bold** and \[^abc]`);
  assert.deepEqual(calls.replacements.map(({ replacement }) => replacement), [String.raw`**bold** and \[^abc]`]);
});

test("does not alter Markdown tables produced by Obsidian", () => {
  const initialText = "before ";
  const { editor, calls } = createEditor(initialText, initialText.length);
  const target = { closest: (selector) => selector === ".cm-content" ? {} : null };
  const view = {
    containerEl: { contains: (element) => element === target },
    editor,
  };
  const event = {
    target,
    clipboardData: {
      getData: (type) => type === "text/html" ? "<table>source</table>" : "source",
    },
    preventDefault: () => assert.fail("native HTML paste must not be prevented"),
    stopPropagation: () => assert.fail("native HTML paste must not be stopped"),
  };

  assert.equal(handleEditorPaste(event, view), false);
  editor.setValue("before | Text |\n| --- |\n| [^abc] |");
  assert.equal(handleEditorChange(editor), false);
  assert.deepEqual(calls.replacements, []);
});

test("preserves existing Markdown escapes and code spans during post-processing", () => {
  const link = String.raw`[\[abc\]](https://example.test)`;
  const inlineCode = "`[^abc]`";
  const fencedCode = "```\n[^abc]\n```";

  assert.equal(escapeObsidianSyntax(link), link);
  assert.equal(escapeObsidianSyntax(inlineCode), inlineCode);
  assert.equal(escapeObsidianSyntax(fencedCode), fencedCode);
});