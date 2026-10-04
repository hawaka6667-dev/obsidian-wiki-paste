"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/wiki-paste-plugin-entry.ts
var wiki_paste_plugin_entry_exports = {};
__export(wiki_paste_plugin_entry_exports, {
  default: () => WikiPastePlugin
});
module.exports = __toCommonJS(wiki_paste_plugin_entry_exports);
var import_obsidian = require("obsidian");

// src/auto-expand-canvas/canvas-auto-expand.ts
var CARD_WIDTH_GUTTER = 32;
var CARD_HEIGHT_GUTTER = 2;
var EDITOR_LAYOUT_SETTLE_MS = 50;
function getExpandedCanvasSize(width, height, contentWidth, contentHeight) {
  return {
    width: Math.max(width, Math.ceil(contentWidth + CARD_WIDTH_GUTTER)),
    height: Math.max(height, Math.ceil(contentHeight + CARD_HEIGHT_GUTTER))
  };
}
function handleCanvasPaste(event, view) {
  if (!isCanvasView(view)) {
    return false;
  }
  const clipboard = event.clipboardData;
  if (!clipboard?.getData("text/plain") && !clipboard?.getData("text/html")) {
    return false;
  }
  const beforePaste = /* @__PURE__ */ new Map();
  for (const node of view.canvas.nodes.values()) {
    const data = node.getData();
    if (data.type === "text") {
      beforePaste.set(data.id, data.text);
    }
  }
  window.requestAnimationFrame(() => {
    for (const node of view.canvas.nodes.values()) {
      const data = node.getData();
      if (data.type !== "text" || beforePaste.get(data.id) === data.text) {
        continue;
      }
      expandCanvasNode(node);
    }
  });
  return true;
}
function isCanvasView(view) {
  if (!view || typeof view !== "object") {
    return false;
  }
  const candidate = view;
  return candidate.getViewType?.() === "canvas" && candidate.canvas?.nodes instanceof Map;
}
function expandCanvasNode(node) {
  const data = node.getData();
  const contentWidth = measureNaturalContentWidth(node.nodeEl);
  const expandedWidth = getExpandedCanvasSize(data.width, data.height, contentWidth, 0).width;
  let dimensionsChanged = false;
  if (expandedWidth > data.width) {
    node.setData({ width: expandedWidth });
    dimensionsChanged = true;
  }
  window.setTimeout(() => window.requestAnimationFrame(() => {
    const contentHeight = measureCanvasContentHeight(node.nodeEl);
    if (contentHeight > 0) {
      const current = node.getData();
      const expandedHeight = Math.max(current.height, Math.ceil(contentHeight + CARD_HEIGHT_GUTTER));
      if (expandedHeight > current.height) {
        node.setData({ height: expandedHeight });
        dimensionsChanged = true;
      }
    }
    if (dimensionsChanged) {
      node.canvas.requestSave();
    }
  }), EDITOR_LAYOUT_SETTLE_MS);
}
function measureCanvasContentHeight(nodeElement) {
  const editorFrame = nodeElement.querySelector("iframe.embed-iframe");
  const editorContent = editorFrame?.contentDocument?.querySelector(".cm-scroller");
  if (editorContent?.scrollHeight) {
    return editorContent.scrollHeight;
  }
  return nodeElement.querySelector(".canvas-node-container")?.scrollHeight ?? 0;
}
function measureNaturalContentWidth(nodeElement) {
  const clone = nodeElement.cloneNode(true);
  clone.style.position = "fixed";
  clone.style.left = "-100000px";
  clone.style.top = "0";
  clone.style.transform = "none";
  clone.style.width = "max-content";
  clone.style.height = "max-content";
  clone.style.setProperty("--canvas-node-width", "max-content");
  clone.style.setProperty("--canvas-node-height", "max-content");
  for (const element of Array.from(clone.querySelectorAll(
    ".canvas-node-container, .canvas-node-content, .markdown-preview-view, .markdown-preview-sizer"
  ))) {
    element.style.setProperty("width", "max-content", "important");
    element.style.setProperty("height", "max-content", "important");
    element.style.setProperty("max-width", "none", "important");
    element.style.setProperty("max-height", "none", "important");
    element.style.setProperty("overflow", "visible", "important");
  }
  document.body.append(clone);
  try {
    return clone.querySelector(".canvas-node-container")?.scrollWidth ?? 0;
  } finally {
    clone.remove();
  }
}

// src/escape-markdown-syntax/md-escape-optimization.ts
function optimizeMarkdownEscapes(line, escapeCandidates, indentationLength, preserveExistingEscapes = false, doubleBackslashCandidates = /* @__PURE__ */ new Set()) {
  if (indentationLength > 0) {
    const indentation = line.slice(0, indentationLength);
    return `${preserveIndentedCodeText(indentation)}${optimizeLineContent(line.slice(indentationLength), escapeCandidates, preserveExistingEscapes, doubleBackslashCandidates)}`;
  }
  return optimizeLineContent(line, escapeCandidates, preserveExistingEscapes, doubleBackslashCandidates);
}
function isMarkdownEscapablePunctuation(character) {
  if (character === void 0) {
    return true;
  }
  const codePoint = character.charCodeAt(0);
  return codePoint >= 33 && codePoint <= 47 || codePoint >= 58 && codePoint <= 64 || codePoint >= 91 && codePoint <= 96 || codePoint >= 123 && codePoint <= 126;
}
function preserveIndentedCodeText(indentation) {
  let column = 0;
  let output = "";
  for (const character of indentation) {
    const width = character === "	" ? 4 - column % 4 : 1;
    output += "&nbsp;".repeat(width);
    column += width;
  }
  return output;
}
function optimizeLineContent(line, escapeCandidates, preserveExistingEscapes, doubleBackslashCandidates) {
  let output = "";
  for (let index = 0; index < line.length; ) {
    if (line[index] === "\\") {
      let runEnd = index + 1;
      while (line[runEnd] === "\\") {
        runEnd += 1;
      }
      const runLength = runEnd - index;
      if (preserveExistingEscapes) {
        output += "\\".repeat(doubleBackslashCandidates.has(index) ? runLength * 2 : runLength);
      } else {
        output += "\\".repeat(isMarkdownEscapablePunctuation(line[runEnd]) ? runLength * 2 : runLength);
      }
      index = runEnd;
      continue;
    }
    if (escapeCandidates.has(index)) {
      output += "\\";
    }
    output += line[index];
    index += 1;
  }
  return output;
}

// src/escape-markdown-syntax/md-syntax-escaping.ts
function markRun(mark, start, length) {
  for (let offset = 0; offset < length; offset += 1) {
    mark(start + offset);
  }
}
function collectRuns(line, marker) {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...line.matchAll(new RegExp(`${escapedMarker}+`, "g"))].map((match) => ({ start: match.index, length: match[0].length }));
}
function isWhitespace(character) {
  return character === void 0 || /\s/u.test(character);
}
function collectEmphasisSyntax(line, marker, mark) {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordBoundaryBefore = marker === "_" ? "(?<![\\p{L}\\p{N}])" : "";
  const wordBoundaryAfter = marker === "_" ? "(?![\\p{L}\\p{N}])" : "";
  const completeRun = `(?!${escapedMarker})`;
  const pattern = new RegExp(
    `${wordBoundaryBefore}(${escapedMarker}+)${completeRun}(?!\\s).*?(?<!\\s)\\1${completeRun}${wordBoundaryAfter}`,
    "gu"
  );
  for (const match of line.matchAll(pattern)) {
    markRun(mark, match.index, match[1].length);
  }
}
function collectPairedMarkerSyntax(line, marker, mark, escapeOpeningLength, escapeClosingRun = false) {
  const runs = collectRuns(line, marker);
  for (let index = 0; index < runs.length; index += 1) {
    const opening = runs[index];
    if (isWhitespace(line[opening.start + opening.length])) {
      continue;
    }
    const closingIndex = runs.findIndex(
      (candidate, candidateIndex) => candidateIndex > index && candidate.length === opening.length && !isWhitespace(line[candidate.start - 1])
    );
    if (closingIndex === -1) {
      continue;
    }
    const closing = runs[closingIndex];
    markRun(mark, opening.start, escapeOpeningLength(opening.length));
    if (escapeClosingRun) {
      markRun(mark, closing.start, escapeOpeningLength(closing.length));
    }
    index = closingIndex;
  }
}
function collectBlockSyntax(line, mark) {
  for (const match of line.matchAll(/^ {0,3}(#{1,6})(?=\s|$)/gm)) {
    mark(match.index + match[0].indexOf(match[1]));
  }
  for (const match of line.matchAll(/^ {0,3}(>)(?=\s|\[!)/gm)) {
    mark(match.index + match[0].indexOf(match[1]));
  }
  for (const match of line.matchAll(/^ {0,3}([-+*])(?=\s)/gm)) {
    mark(match.index + match[0].indexOf(match[1]));
  }
  for (const match of line.matchAll(/^ {0,3}\d{1,9}([.)])(?=\s)/gm)) {
    mark(match.index + match[0].indexOf(match[1]));
  }
  for (const match of line.matchAll(/^ {0,3}(`{3,}|~{3,})/gm)) {
    const start = match.index + match[0].indexOf(match[1]);
    markRun(mark, start, match[1].length);
  }
  const thematicBreak = /^ {0,3}(?:(?:\* *){3,}|(?:- *){3,}|(?:_ *){3,})(?:<br\s*\/?\s*>)?\s*$/i.exec(line);
  if (thematicBreak) {
    mark(thematicBreak.index + thematicBreak[0].search(/[\*_-]/));
  }
}
function collectReferenceLinkSyntax(line, mark) {
  for (const match of line.matchAll(/!?\[[^\]\r\n]+\]\[[^\]\r\n]*\]/g)) {
    const firstOpening = match.index + match[0].indexOf("[");
    const secondOpening = match.index + match[0].indexOf("[", match[0].indexOf("]") + 1);
    mark(firstOpening);
    if (secondOpening !== -1) {
      mark(secondOpening);
    }
  }
}
function collectInlineCodeSyntax(line, mark) {
  const runs = collectRuns(line, "`");
  for (let index = 0; index < runs.length; index += 1) {
    const opening = runs[index];
    const closingIndex = runs.findIndex(
      (candidate, candidateIndex) => candidateIndex > index && candidate.length === opening.length
    );
    if (closingIndex === -1) {
      continue;
    }
    markRun(mark, opening.start, opening.length);
    index = closingIndex;
  }
}
function collectObsidianSyntax(line, mark, linkLabels = []) {
  for (const match of line.matchAll(/\[\^[^\]\r\n]+\]/g)) {
    if (!linkLabels.some((range) => match.index < range.end && match.index + match[0].length > range.start)) {
      mark(match.index);
    }
  }
  for (const match of line.matchAll(/\[\[[^\]\r\n]+\]\]/g)) {
    if (!linkLabels.some((range) => match.index < range.end && match.index + match[0].length > range.start)) {
      mark(match.index);
      mark(match.index + 1);
    }
  }
  for (const match of line.matchAll(/(?:^|\s|\\)#(?=[\p{L}\p{N}_/-])/gu)) {
    mark(match.index + match[0].length - 1);
  }
  for (const match of line.matchAll(/(?:^|\s)\^[\w-]+(?=\s*$)/g)) {
    mark(match.index + match[0].length - match[0].trimStart().length);
  }
  const commentMarkers = [...line.matchAll(/%%/g)];
  for (let index = 0; index + 1 < commentMarkers.length; index += 2) {
    mark(commentMarkers[index].index);
  }
  for (const match of line.matchAll(/<\/?[A-Za-z][^>\r\n]*>/g)) {
    mark(match.index);
  }
}
function isInsideRange(index, ranges) {
  return ranges.some((range) => index >= range.start && index < range.end);
}
function findMarkdownLinkEnd(line, openingParenthesis, codeRanges) {
  let depth = 0;
  for (let index = openingParenthesis; index < line.length; index += 1) {
    if (isInsideRange(index, codeRanges) || isEscapedByBackslash(line, index)) {
      continue;
    }
    if (line[index] === "(") {
      depth += 1;
    } else if (line[index] === ")") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  return -1;
}
function collectMarkdownLinks(line, codeRanges) {
  const labels = [];
  const links = [];
  for (let start = 0; start < line.length; start += 1) {
    if (line[start] !== "[" || isEscapedByBackslash(line, start) || isInsideRange(start, codeRanges)) {
      continue;
    }
    let depth = 1;
    for (let index = start + 1; index < line.length; index += 1) {
      if (isInsideRange(index, codeRanges) || isEscapedByBackslash(line, index)) {
        continue;
      }
      if (line[index] === "[") {
        depth += 1;
      } else if (line[index] === "]") {
        depth -= 1;
        if (depth === 0) {
          if (line[index + 1] === "(") {
            labels.push({ start: start + 1, end: index });
            const linkEnd = findMarkdownLinkEnd(line, index + 1, codeRanges);
            if (linkEnd !== -1) {
              links.push({ start, end: linkEnd });
            }
          }
          start = index;
          break;
        }
      }
    }
  }
  return { labels, links };
}
function collectUnmatchedOpeningBrackets(line, codeRanges, markdownLinks, mark) {
  const openings = [];
  for (let index = 0; index < line.length; index += 1) {
    if (isInsideRange(index, codeRanges) || isInsideRange(index, markdownLinks) || isEscapedByBackslash(line, index)) {
      continue;
    }
    if (line[index] === "[") {
      openings.push(index);
    } else if (line[index] === "]" && openings.length > 0) {
      openings.pop();
    }
  }
  openings.forEach(mark);
}
function collectLinkLabelSyntax(line, labels, codeRanges, mark, isTableCell = false) {
  const doubleBackslashCandidates = /* @__PURE__ */ new Set();
  for (const label of labels) {
    for (let index = label.start; index < label.end; index += 1) {
      if ((line[index] === "[" || line[index] === "]") && !isEscapedByBackslash(line, index) && !isInsideRange(index, codeRanges)) {
        mark(index);
      }
      if (line[index] !== "\\" || isInsideRange(index, codeRanges)) {
        continue;
      }
      let runEnd = index + 1;
      while (line[runEnd] === "\\") {
        runEnd += 1;
      }
      const punctuation = line[runEnd];
      if (runEnd - index === 1 && punctuation !== void 0 && punctuation !== "[" && punctuation !== "]" && !(isTableCell && punctuation === "|") && isMarkdownEscapablePunctuation(punctuation)) {
        doubleBackslashCandidates.add(index);
      }
      index = runEnd - 1;
    }
  }
  return doubleBackslashCandidates;
}
function isMarkdownTableSeparator(line) {
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.length > 0 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}
function findMarkdownTableLines(lines) {
  const tableLines = /* @__PURE__ */ new Set();
  for (let index = 0; index < lines.length; index += 1) {
    if (!isMarkdownTableSeparator(lines[index])) {
      continue;
    }
    let firstLine = index;
    while (firstLine > 0 && lines[firstLine - 1].includes("|")) {
      firstLine -= 1;
    }
    let lastLine = index;
    while (lastLine + 1 < lines.length && lines[lastLine + 1].includes("|")) {
      lastLine += 1;
    }
    for (let tableLine = firstLine; tableLine <= lastLine; tableLine += 1) {
      tableLines.add(tableLine);
    }
  }
  return tableLines;
}
function collectInlineCodeRanges(line) {
  const runs = collectRuns(line, "`");
  const ranges = [];
  for (let index = 0; index < runs.length; index += 1) {
    const opening = runs[index];
    const closingIndex = runs.findIndex(
      (candidate, candidateIndex) => candidateIndex > index && candidate.length === opening.length
    );
    if (closingIndex === -1) {
      continue;
    }
    ranges.push({ start: opening.start, end: runs[closingIndex].start + runs[closingIndex].length });
    index = closingIndex;
  }
  return ranges;
}
function isEscapedByBackslash(line, index) {
  let precedingSlashes = 0;
  for (let preceding = index - 1; preceding >= 0 && line[preceding] === "\\"; preceding -= 1) {
    precedingSlashes += 1;
  }
  return precedingSlashes % 2 === 1;
}
function escapeObsidianLine(content, isTableCell = false) {
  const syntaxContent = isTableCell ? { content, indentationLength: 0 } : getSyntaxContent(content);
  if (syntaxContent.indentationLength > 0) {
    return content;
  }
  const escapeCandidates = /* @__PURE__ */ new Set();
  const codeRanges = collectInlineCodeRanges(syntaxContent.content);
  const { labels: linkLabels, links: markdownLinks } = collectMarkdownLinks(syntaxContent.content, codeRanges);
  const mark = (offset) => {
    const insideInlineCode = isInsideRange(offset, codeRanges);
    if (!insideInlineCode && !isEscapedByBackslash(syntaxContent.content, offset)) {
      escapeCandidates.add(offset);
    }
  };
  const doubleBackslashCandidates = collectLinkLabelSyntax(syntaxContent.content, linkLabels, codeRanges, mark, isTableCell);
  collectUnmatchedOpeningBrackets(syntaxContent.content, codeRanges, markdownLinks, mark);
  collectObsidianSyntax(syntaxContent.content, mark, linkLabels);
  return optimizeMarkdownEscapes(content, escapeCandidates, syntaxContent.indentationLength, true, doubleBackslashCandidates);
}
function escapeMarkdownTableLine(line) {
  if (isMarkdownTableSeparator(line)) {
    return line;
  }
  let output = "";
  let cellStart = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "|" || isEscapedByBackslash(line, index)) {
      continue;
    }
    output += `${escapeObsidianLine(line.slice(cellStart, index), true)}|`;
    cellStart = index + 1;
  }
  return output + escapeObsidianLine(line.slice(cellStart), true);
}
function escapeObsidianSyntax(text) {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const contentLines = lines.map((line) => line.replace(/\r?\n$/, ""));
  const markdownTableLines = findMarkdownTableLines(contentLines);
  let activeFence;
  return lines.map((line, index) => {
    const lineEnding = line.endsWith("\r\n") ? "\r\n" : line.endsWith("\n") ? "\n" : "";
    const content = line.slice(0, line.length - lineEnding.length);
    if (activeFence) {
      const closingFence = new RegExp(`^ {0,3}${activeFence.marker}{${activeFence.length},}\\s*$`);
      if (closingFence.test(content)) {
        activeFence = void 0;
      }
      return line;
    }
    const openingFence = /^ {0,3}(`{3,}|~{3,})/.exec(content);
    if (openingFence) {
      activeFence = { marker: openingFence[1][0], length: openingFence[1].length };
      return line;
    }
    if (markdownTableLines.has(index)) {
      return `${escapeMarkdownTableLine(content)}${lineEnding}`;
    }
    if (getSyntaxContent(content).indentationLength > 0) {
      return line;
    }
    return `${escapeObsidianLine(content)}${lineEnding}`;
  }).join("");
}
function collectSyntaxEscapes(line) {
  const candidates = /* @__PURE__ */ new Set();
  const mark = (index) => candidates.add(index);
  collectBlockSyntax(line, mark);
  collectReferenceLinkSyntax(line, mark);
  collectEmphasisSyntax(line, "*", mark);
  collectEmphasisSyntax(line, "_", mark);
  collectPairedMarkerSyntax(line, "~", mark, () => 1, true);
  collectPairedMarkerSyntax(line, "=", mark, () => 1, true);
  collectPairedMarkerSyntax(line, "$", mark, (length) => length);
  collectInlineCodeSyntax(line, mark);
  collectObsidianSyntax(line, mark);
  return candidates;
}
function getSyntaxContent(line) {
  const indentation = line.match(/^[ \t]*/)?.[0] ?? "";
  let indentationColumns = 0;
  for (const character of indentation) {
    indentationColumns += character === "	" ? 4 - indentationColumns % 4 : 1;
  }
  if (indentationColumns >= 4 && indentation.length < line.length) {
    return { content: line.slice(indentation.length), indentationLength: indentation.length };
  }
  return { content: line, indentationLength: 0 };
}
function escapeMarkdownSyntax(text) {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  return lines.map((line) => {
    const lineEnding = line.endsWith("\r\n") ? "\r\n" : line.endsWith("\n") ? "\n" : "";
    const content = line.slice(0, line.length - lineEnding.length);
    const syntaxContent = getSyntaxContent(content);
    const escapeCandidates = collectSyntaxEscapes(syntaxContent.content);
    return `${optimizeMarkdownEscapes(content, escapeCandidates, syntaxContent.indentationLength)}${lineEnding}`;
  }).join("");
}

// src/escape-markdown-syntax/md-editor-paste-handler.ts
var pendingHtmlPastes = /* @__PURE__ */ new WeakMap();
var recentInternalMarkdownCopies = /* @__PURE__ */ new WeakMap();
var internalCopyLifetimeMs = 1e4;
function handleEditorCopy(event, view) {
  const document2 = view.containerEl.ownerDocument;
  recentInternalMarkdownCopies.delete(document2);
  const target = event.target;
  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }
  const clipboardText = event.clipboardData?.getData("text/plain");
  const copiedText = clipboardText || view.editor.getSelection();
  if (!copiedText) {
    return false;
  }
  recentInternalMarkdownCopies.set(document2, { text: copiedText, copiedAt: Date.now() });
  return true;
}
function clearRecentInternalMarkdownCopy(document2) {
  recentInternalMarkdownCopies.delete(document2);
}
function consumeRecentInternalMarkdownCopy(document2, clipboardText) {
  const recentCopy = recentInternalMarkdownCopies.get(document2);
  if (!recentCopy) {
    return false;
  }
  recentInternalMarkdownCopies.delete(document2);
  const age = Date.now() - recentCopy.copiedAt;
  return clipboardText === recentCopy.text && age >= 0 && age <= internalCopyLifetimeMs;
}
function handleEditorPaste(event, view) {
  const target = event.target;
  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }
  const clipboardData = event.clipboardData;
  const clipboardText = clipboardData?.getData("text/plain");
  if (consumeRecentInternalMarkdownCopy(view.containerEl.ownerDocument, clipboardText)) {
    return false;
  }
  const clipboardHtml = clipboardData?.getData("text/html");
  if (clipboardHtml) {
    const editor = view.editor;
    const pendingPaste = {
      value: editor.getValue(),
      selectionFrom: editor.posToOffset(editor.getCursor("from")),
      selectionTo: editor.posToOffset(editor.getCursor("to"))
    };
    pendingHtmlPastes.set(editor, pendingPaste);
    setTimeout(() => {
      if (pendingHtmlPastes.get(editor) === pendingPaste) {
        pendingHtmlPastes.delete(editor);
      }
    }, 0);
    return false;
  }
  if (typeof clipboardText !== "string") {
    return false;
  }
  const convertedText = escapeMarkdownSyntax(clipboardText);
  if (convertedText === clipboardText) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  view.editor.replaceSelection(convertedText);
  return true;
}
function handleEditorChange(editor) {
  const pendingPaste = pendingHtmlPastes.get(editor);
  if (!pendingPaste) {
    return false;
  }
  pendingHtmlPastes.delete(editor);
  const currentValue = editor.getValue();
  if (currentValue === pendingPaste.value) {
    return false;
  }
  const changeStart = pendingPaste.selectionFrom;
  const insertedEnd = editor.posToOffset(editor.getCursor("head"));
  if (insertedEnd < changeStart || currentValue.slice(0, changeStart) !== pendingPaste.value.slice(0, changeStart) || currentValue.slice(insertedEnd) !== pendingPaste.value.slice(pendingPaste.selectionTo)) {
    return false;
  }
  const insertedText = currentValue.slice(changeStart, insertedEnd);
  const convertedText = escapeObsidianSyntax(insertedText);
  if (convertedText === insertedText) {
    return false;
  }
  editor.replaceRange(convertedText, editor.offsetToPos(changeStart), editor.offsetToPos(insertedEnd));
  return true;
}

// src/wiki-paste-plugin-entry.ts
var DEFAULT_SETTINGS = { escapeMarkdownSyntax: true, autoExpandCanvasCards: true };
var WikiPastePlugin = class extends import_obsidian.Plugin {
  async onload() {
    const savedSettings = await this.loadData();
    this.settings = {
      escapeMarkdownSyntax: savedSettings?.escapeMarkdownSyntax ?? savedSettings?.escapeFootnoteReferences ?? DEFAULT_SETTINGS.escapeMarkdownSyntax,
      autoExpandCanvasCards: savedSettings?.autoExpandCanvasCards ?? DEFAULT_SETTINGS.autoExpandCanvasCards
    };
    this.addSettingTab(new WikiPasteSettingTab(this.app, this));
    this.registerDomEvent(document, "copy", (event) => {
      const markdownView = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
      if (markdownView) {
        handleEditorCopy(event, markdownView);
      }
    });
    this.registerDomEvent(window, "blur", () => clearRecentInternalMarkdownCopy(document));
    this.registerDomEvent(document, "paste", (event) => {
      if (this.settings.escapeMarkdownSyntax) {
        const markdownView = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
        if (markdownView) {
          handleEditorPaste(event, markdownView);
        }
      }
      if (this.settings.autoExpandCanvasCards) {
        const activeView = this.app.workspace.activeLeaf?.view;
        if (activeView) {
          handleCanvasPaste(event, activeView);
        }
      }
    }, { capture: true });
    this.registerEvent(this.app.workspace.on("editor-change", (editor) => {
      if (this.settings.escapeMarkdownSyntax) {
        handleEditorChange(editor);
      }
    }));
  }
  async setMarkdownEscapingEnabled(enabled) {
    this.settings.escapeMarkdownSyntax = enabled;
    await this.saveData(this.settings);
  }
  async setCanvasAutoExpandEnabled(enabled) {
    this.settings.autoExpandCanvasCards = enabled;
    await this.saveData(this.settings);
  }
};
var WikiPasteSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Escape pasted Markdown syntax").setDesc("Prevent Markdown and Obsidian syntax in plain-text pastes from being rendered as formatting.").addToggle((toggle) => toggle.setValue(this.plugin.settings.escapeMarkdownSyntax).onChange((enabled) => this.plugin.setMarkdownEscapingEnabled(enabled)));
    new import_obsidian.Setting(containerEl).setName("Auto-expand pasted Canvas cards").setDesc("Resize text cards after pasting so their content is visible.").addToggle((toggle) => toggle.setValue(this.plugin.settings.autoExpandCanvasCards).onChange((enabled) => this.plugin.setCanvasAutoExpandEnabled(enabled)));
  }
};
