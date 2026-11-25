import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { handleMoveSelectedLinesKeydown } from "../src/editor-actions/move-selected-lines.ts";
import { handleSelectLineThenAllKeydown } from "../src/editor-actions/select-line-then-all.ts";

function createKeydownEvent(target, key, modifiers = {}) {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    target,
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
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
    ...modifiers,
  };
}

function createEditor(initialLines, anchorPos, headPos = anchorPos) {
  const lines = [...initialLines];
  let anchor = { ...anchorPos };
  let head = { ...headPos };

  const ordered = () => {
    if (anchor.line < head.line || (anchor.line === head.line && anchor.ch <= head.ch)) {
      return { from: anchor, to: head };
    }
    return { from: head, to: anchor };
  };

  return {
    getCursor: (side) => {
      if (side === "anchor") {
        return { ...anchor };
      }
      if (side === "head") {
        return { ...head };
      }
      const { from, to } = ordered();
      return side === "to" ? { ...to } : { ...from };
    },
    getLine: (line) => lines[line] ?? "",
    lineCount: () => lines.length,
    replaceRange: (replacement, from, to) => {
      const prefix = lines[from.line].slice(0, from.ch);
      const suffix = lines[to.line].slice(to.ch);
      const inserted = `${prefix}${replacement}${suffix}`.split("\n");
      lines.splice(from.line, to.line - from.line + 1, ...inserted);
    },
    setSelection: (nextAnchor, nextHead = nextAnchor) => {
      anchor = { ...nextAnchor };
      head = { ...nextHead };
    },
    get lines() {
      return [...lines];
    },
    get selection() {
      return { anchor, head };
    },
  };
}

test("OneNote Ctrl+A selects current line first, then passes through to Select All", () => {
  const dom = new JSDOM("<div class='view'><div class='cm-content'></div><input /></div>");
  const containerEl = dom.window.document.querySelector(".view");
  const cmContent = containerEl.querySelector(".cm-content");
  const input = containerEl.querySelector("input");
  const editor = createEditor(["first line", "second line"], { line: 1, ch: 3 });
  const view = { containerEl, editor };

  const first = createKeydownEvent(cmContent, "a", { ctrlKey: true });
  assert.equal(handleSelectLineThenAllKeydown(first, view), true);
  assert.equal(first.defaultPrevented, true);
  assert.deepEqual(editor.selection, {
    anchor: { line: 1, ch: 0 },
    head: { line: 1, ch: "second line".length },
  });

  const second = createKeydownEvent(cmContent, "a", { ctrlKey: true });
  assert.equal(handleSelectLineThenAllKeydown(second, view), false);

  assert.equal(handleSelectLineThenAllKeydown(createKeydownEvent(cmContent, "a", { ctrlKey: true, repeat: true }), view), false);
  assert.equal(handleSelectLineThenAllKeydown(createKeydownEvent(input, "a", { ctrlKey: true }), view), false);
  dom.window.close();
});

test("Alt+Up/Down swaps single and multi-line selections in Markdown and Canvas editors", () => {
  const dom = new JSDOM("<div class='canvas'><div class='canvas-node'><div class='cm-content'></div></div></div>");
  const canvasEl = dom.window.document.querySelector(".canvas");
  const nodeEl = dom.window.document.querySelector(".canvas-node");
  const cmContent = nodeEl.querySelector(".cm-content");

  const editor = createEditor(["zero", "one", "two", "three"], { line: 2, ch: 3 }, { line: 1, ch: 1 });
  const canvasView = {
    getViewType: () => "canvas",
    containerEl: canvasEl,
    canvas: { nodes: new Map([["card", { nodeEl, child: { editor } }]]) },
  };

  const down = createKeydownEvent(cmContent, "ArrowDown", { altKey: true });
  assert.equal(handleMoveSelectedLinesKeydown(down, null, canvasView), true);
  assert.equal(down.defaultPrevented, true);
  assert.deepEqual(editor.lines, ["zero", "three", "one", "two"]);
  assert.deepEqual(editor.selection, { anchor: { line: 3, ch: 3 }, head: { line: 2, ch: 1 } });

  const up = createKeydownEvent(cmContent, "ArrowUp", { altKey: true });
  assert.equal(handleMoveSelectedLinesKeydown(up, null, canvasView), true);
  assert.deepEqual(editor.lines, ["zero", "one", "two", "three"]);
  assert.deepEqual(editor.selection, { anchor: { line: 2, ch: 3 }, head: { line: 1, ch: 1 } });

  dom.window.close();
});
