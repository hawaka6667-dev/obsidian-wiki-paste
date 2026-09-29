const assert = require("node:assert/strict");
const test = require("node:test");
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

test("converts and inserts a collision from a real paste event", () => {
  const event = createPasteEvent("Copied [^abc] text");
  const view = createView(event.target);

  assert.equal(handleEditorPaste(event, view), true);
  assert.deepEqual(view.inserted, ["Copied \\[^abc\\] text"]);
  assert.equal(event.calls.prevented, true);
  assert.equal(event.calls.stopped, true);
});

test("leaves native paste alone when there is no collision", () => {
  const event = createPasteEvent("[[abc]] and [abc](url)");
  const view = createView(event.target);

  assert.equal(handleEditorPaste(event, view), false);
  assert.deepEqual(view.inserted, []);
  assert.equal(event.calls.prevented, false);
});

test("leaves rich HTML paste to Obsidian even when plain text contains a collision", () => {
  const event = createPasteEvent("Title [^abc]", true, "<table><tr><td>Title [^abc]</td></tr></table>");
  const view = createView(event.target);

  assert.equal(handleEditorPaste(event, view), false);
  assert.deepEqual(view.inserted, []);
  assert.equal(event.calls.prevented, false);
  assert.equal(event.calls.stopped, false);
});

test("ignores paste events outside the editor", () => {
  const event = createPasteEvent("[^abc]", false);
  const view = createView(event.target);

  assert.equal(handleEditorPaste(event, view), false);
  assert.deepEqual(view.inserted, []);
});