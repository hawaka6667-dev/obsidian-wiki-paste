const assert = require("node:assert/strict");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("");
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;

const { handleEditorPaste } = require("../src/paste-handler.ts");

function createPasteEvent(text, inEditor = true, html = "") {
  const calls = { prevented: false, stopped: false };
  const target = {
    closest: (selector) => selector === ".cm-content" && inEditor ? target : null
  };

  return {
    calls,
    target,
    clipboardData: {
      getData: (type) => type === "text/plain" ? text : type === "text/html" ? html : ""
    },
    preventDefault: () => { calls.prevented = true; },
    stopPropagation: () => { calls.stopped = true; }
  };
}

function createView(target) {
  const inserted = [];

  return {
    inserted,
    containerEl: { contains: (candidate) => candidate === target },
    editor: { replaceSelection: (text) => inserted.push(text) }
  };
}

test("converts Markdown syntax to literal text in a plain-text paste event", () => {
  const event = createPasteEvent("# Copied [^abc]");
  const view = createView(event.target);

  assert.equal(handleEditorPaste(event, view), true);
  assert.deepEqual(view.inserted, ["\\# Copied \\[^abc]"]);
  assert.equal(event.calls.prevented, true);
  assert.equal(event.calls.stopped, true);
});

test("leaves native paste alone when plain text has no Markdown punctuation", () => {
  const event = createPasteEvent("plain words 123");
  const view = createView(event.target);

  assert.equal(handleEditorPaste(event, view), false);
  assert.deepEqual(view.inserted, []);
  assert.equal(event.calls.prevented, false);
});

test("converts rich HTML tables to Markdown while preserving linked regex text", () => {
  const html = `<table><tbody>
    <tr><td><a href="https://regexone.com/matching">[abc]</a></td><td>Only a, b, or c</td></tr>
    <tr><td><a href="https://regexone.com/digit">\\d</a></td><td>Any Digit</td></tr>
  </tbody></table>`;
  const event = createPasteEvent("[abc] Any Digit", true, html);
  const view = createView(event.target);

  assert.equal(handleEditorPaste(event, view), true);
  assert.deepEqual(view.inserted, [
    "|  |  |\n| --- | --- |\n| [\\[abc\\]](https://regexone.com/matching) | Only a, b, or c |\n| [\\\\d](https://regexone.com/digit) | Any Digit |",
  ]);
  assert.equal(event.calls.prevented, true);
  assert.equal(event.calls.stopped, true);
});

test("escapes a pipe inside a linked table cell without corrupting adjacent links", () => {
  const url = "https://regexone.com/lesson/conditionals";
  const html = `<table><tbody>
    <tr><td><a href="${url}" title="Lesson 14: It's all conditional">(abc|def)</a></td></tr>
    <tr><td><a href="${url}">Matches abc or def</a></td></tr>
  </tbody></table>`;
  const event = createPasteEvent("[(abc|def)](url)", true, html);
  const view = createView(event.target);

  assert.equal(handleEditorPaste(event, view), true);
  assert.deepEqual(view.inserted, [
    `|  |\n| --- |\n| [(abc\\|def)](${url} "Lesson 14: It's all conditional") |\n| [Matches abc or def](${url}) |`,
  ]);
  assert.equal(event.calls.prevented, true);
  assert.equal(event.calls.stopped, true);
});

test("distinguishes table separators from multiple pipes in varied cell content", () => {
  const html = `<table><thead><tr><th>Pattern</th><th>Notes</th><th>Code</th></tr></thead><tbody>
    <tr>
      <td><a href="https://x.test/pipes" title="pipe|title">(a|b||c)</a></td>
      <td>left|middle|right</td>
      <td><code>x|y||z</code></td>
    </tr>
    <tr><td><a href="https://x.test/edges">(x|y)</a></td><td>&#124;edges&#124;</td><td>slash \\| pipe</td></tr>
  </tbody></table>`;
  const event = createPasteEvent("copied table", true, html);
  const view = createView(event.target);

  assert.equal(handleEditorPaste(event, view), true);
  assert.deepEqual(view.inserted, [
    "| Pattern | Notes | Code |\n| --- | --- | --- |\n| [(a\\|b\\|\\|c)](https://x.test/pipes \"pipe\\|title\") | left\\|middle\\|right | `x\\|y\\|\\|z` |\n| [(x\\|y)](https://x.test/edges) | \\|edges\\| | slash \\\\\\| pipe |",
  ]);
});

test("ignores paste events outside the editor", () => {
  const event = createPasteEvent("[^abc]", false);
  const view = createView(event.target);

  assert.equal(handleEditorPaste(event, view), false);
  assert.deepEqual(view.inserted, []);
});