import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  clearRecentInternalMarkdownCopy,
  handleEditorChange,
  handleEditorCopy,
  handleEditorPaste,
} from "../src/escape-markdown-syntax/md-editor-paste-handler.ts";

function createEvent(target, values = {}) {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    target,
    clipboardData: { getData: (type) => values[type] ?? "" },
    preventDefault() {
      defaultPrevented = true;
    },
    stopPropagation() {
      propagationStopped = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
    get propagationStopped() {
      return propagationStopped;
    },
  };
}

test("preserves Markdown copied inside Obsidian but still escapes external plain text", () => {
  const dom = new JSDOM("<div class='view'><div class='cm-content'></div></div>");
  const containerEl = dom.window.document.querySelector(".view");
  const editorContent = containerEl.querySelector(".cm-content");
  const copiedText = "[^ref29]: Footnote source.";
  const replacements = [];
  const editor = {
    getSelection: () => copiedText,
    replaceSelection: (text) => replacements.push(text),
    getValue: () => "",
  };
  const view = { containerEl, editor };

  assert.equal(handleEditorCopy(createEvent(editorContent), view), true);

  const internalRichPaste = createEvent(editorContent, {
    "text/plain": copiedText,
    "text/html": "<p>[^ref29]: Footnote source.</p>",
  });
  assert.equal(handleEditorPaste(internalRichPaste, view), false);
  assert.equal(handleEditorChange(editor), false);
  assert.deepEqual(replacements, []);
  assert.equal(internalRichPaste.defaultPrevented, false);

  const externalPlainPaste = createEvent(editorContent, { "text/plain": copiedText });
  assert.equal(handleEditorPaste(externalPlainPaste, view), true);
  assert.deepEqual(replacements, [String.raw`\[^ref29]: Footnote source.`]);
  assert.equal(externalPlainPaste.defaultPrevented, true);

  clearRecentInternalMarkdownCopy(dom.window.document);
  dom.window.close();
});
