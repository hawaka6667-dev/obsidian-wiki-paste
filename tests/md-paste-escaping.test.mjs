import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  clearRecentInternalMarkdownCopy,
  handleEditorChange,
  handleEditorCopy,
  handleEditorCut,
  handleEditorPaste,
} from "../src/escape-markdown-syntax/md-editor-paste-handler.ts";
import { escapeMarkdownSyntax, escapeObsidianSyntax } from "../src/escape-markdown-syntax/md-syntax-escaping.ts";

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

test("escapes Markdown/Obsidian syntax in plain-text and table-cell post-processing", () => {
  assert.equal(escapeMarkdownSyntax("[^abc]"), String.raw`\[^abc]`);
  assert.equal(escapeMarkdownSyntax("~~strike~~ and ==mark=="), String.raw`\~~strike\~~ and \==mark\==`);
  assert.equal(escapeMarkdownSyntax("text #tag/sub-tag"), String.raw`text \#tag/sub-tag`);
  assert.equal(escapeObsidianSyntax("[^ref29]: Footnote source."), String.raw`\[^ref29]: Footnote source.`);
  assert.equal(
    escapeObsidianSyntax("| [[^abc]](https://example.com) | [\\.](https://example.com) |"),
    "| [\\[^abc\\]](https://example.com) | [\\\\.](https://example.com) |",
  );
});

test("bypasses escaping for internal Obsidian copy/cut while escaping external plain-text paste", () => {
  const dom = new JSDOM("<div class='view'><div class='cm-content'></div></div>");
  const containerEl = dom.window.document.querySelector(".view");
  const editorContent = containerEl.querySelector(".cm-content");
  const copiedText = "![[Pasted image.png|362]]";
  const replacements = [];
  const editor = {
    getSelection: () => copiedText,
    replaceSelection: (text) => replacements.push(text),
    getValue: () => "",
  };
  const view = { containerEl, editor };

  assert.equal(handleEditorCopy(createEvent(editorContent), view), true);
  assert.equal(handleEditorPaste(createEvent(editorContent, { "text/plain": copiedText }), view), false);
  assert.equal(handleEditorCut(createEvent(editorContent), view), true);
  assert.equal(handleEditorPaste(createEvent(editorContent, { "text/plain": copiedText, "text/html": "<img src='x'>" }), view), false);
  assert.equal(handleEditorChange(editor), false);
  assert.deepEqual(replacements, []);

  const external = createEvent(editorContent, { "text/plain": "[^ref29]: Footnote source." });
  assert.equal(handleEditorPaste(external, view), true);
  assert.deepEqual(replacements, [String.raw`\[^ref29]: Footnote source.`]);
  assert.equal(external.defaultPrevented, true);

  clearRecentInternalMarkdownCopy(dom.window.document);
  dom.window.close();
});
