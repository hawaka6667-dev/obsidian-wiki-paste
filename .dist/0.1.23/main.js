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

// src/md-escape-optimization.ts
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

// src/md-syntax-escaping.ts
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
function collectPairedMarkerSyntax(line, marker, mark, escapeOpeningLength) {
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
    markRun(mark, opening.start, escapeOpeningLength(opening.length));
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
function collectLinkLabelSyntax(line, labels, codeRanges, mark) {
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
      if (runEnd - index === 1 && punctuation !== void 0 && punctuation !== "[" && punctuation !== "]" && isMarkdownEscapablePunctuation(punctuation)) {
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
    if (markdownTableLines.has(index) || getSyntaxContent(content).indentationLength > 0) {
      return line;
    }
    const syntaxContent = getSyntaxContent(content);
    const escapeCandidates = /* @__PURE__ */ new Set();
    const codeRanges = collectInlineCodeRanges(syntaxContent.content);
    const { labels: linkLabels, links: markdownLinks } = collectMarkdownLinks(syntaxContent.content, codeRanges);
    const mark = (offset) => {
      const insideInlineCode = isInsideRange(offset, codeRanges);
      if (!insideInlineCode && !isEscapedByBackslash(syntaxContent.content, offset)) {
        escapeCandidates.add(offset);
      }
    };
    const doubleBackslashCandidates = collectLinkLabelSyntax(syntaxContent.content, linkLabels, codeRanges, mark);
    collectUnmatchedOpeningBrackets(syntaxContent.content, codeRanges, markdownLinks, mark);
    collectObsidianSyntax(syntaxContent.content, mark, linkLabels);
    return `${optimizeMarkdownEscapes(content, escapeCandidates, syntaxContent.indentationLength, true, doubleBackslashCandidates)}${lineEnding}`;
  }).join("");
}
function collectSyntaxEscapes(line) {
  const candidates = /* @__PURE__ */ new Set();
  const mark = (index) => candidates.add(index);
  collectBlockSyntax(line, mark);
  collectReferenceLinkSyntax(line, mark);
  collectEmphasisSyntax(line, "*", mark);
  collectEmphasisSyntax(line, "_", mark);
  collectPairedMarkerSyntax(line, "~", mark, () => 1);
  collectPairedMarkerSyntax(line, "=", mark, () => 1);
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

// src/md-editor-paste-handler.ts
var pendingHtmlPastes = /* @__PURE__ */ new WeakMap();
function handleEditorPaste(event, view) {
  const target = event.target;
  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }
  const clipboardHtml = event.clipboardData?.getData("text/html");
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
  const clipboardText = event.clipboardData?.getData("text/plain");
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
var DEFAULT_SETTINGS = { escapeMarkdownSyntax: true };
var WikiPastePlugin = class extends import_obsidian.Plugin {
  async onload() {
    const savedSettings = await this.loadData();
    this.settings = {
      escapeMarkdownSyntax: savedSettings?.escapeMarkdownSyntax ?? savedSettings?.escapeFootnoteReferences ?? DEFAULT_SETTINGS.escapeMarkdownSyntax
    };
    this.addSettingTab(new WikiPasteSettingTab(this.app, this));
    this.registerDomEvent(document, "paste", (event) => {
      if (!this.settings.escapeMarkdownSyntax) {
        return;
      }
      const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
      if (view) {
        handleEditorPaste(event, view);
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
  }
};
