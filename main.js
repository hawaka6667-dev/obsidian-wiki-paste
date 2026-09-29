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

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => WikiPastePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/compatibility.ts
function countPrecedingBackslashes(text, index) {
  let count = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    count += 1;
  }
  return count;
}
function escapeFootnoteReferencesInText(text) {
  return text.replace(/\[\^([^\]\r\n]+)\]/g, (match, label, offset, source) => {
    const closingBracket = offset + match.length - 1;
    const openingIsEscaped = countPrecedingBackslashes(source, offset) % 2 === 1;
    const closingIsEscaped = countPrecedingBackslashes(source, closingBracket) % 2 === 1;
    if (openingIsEscaped || closingIsEscaped) {
      return match;
    }
    return `\\[^${label}\\]`;
  });
}
function escapeOutsideInlineCode(text) {
  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const opening = text.indexOf("`", cursor);
    if (opening === -1) {
      output += escapeFootnoteReferencesInText(text.slice(cursor));
      break;
    }
    output += escapeFootnoteReferencesInText(text.slice(cursor, opening));
    let openingEnd = opening;
    while (text[openingEnd] === "`") {
      openingEnd += 1;
    }
    const delimiter = text.slice(opening, openingEnd);
    let closing = openingEnd;
    while (closing < text.length) {
      closing = text.indexOf("`", closing);
      if (closing === -1) {
        break;
      }
      let closingEnd2 = closing;
      while (text[closingEnd2] === "`") {
        closingEnd2 += 1;
      }
      if (closingEnd2 - closing === delimiter.length) {
        break;
      }
      closing = closingEnd2;
    }
    if (closing === -1) {
      output += delimiter;
      cursor = openingEnd;
      continue;
    }
    const closingEnd = closing + delimiter.length;
    output += text.slice(opening, closingEnd);
    cursor = closingEnd;
  }
  return output;
}
function escapeFootnoteReferences(text) {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
  let output = "";
  let plainText = "";
  let fence = null;
  for (const line of lines) {
    const content = line.replace(/\r?\n$/, "");
    if (fence) {
      output += line;
      const closingFence = content.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (closingFence && closingFence[1][0] === fence.character && closingFence[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }
    const openingFence = content.match(/^ {0,3}(`{3,}|~{3,})/);
    if (openingFence) {
      output += escapeOutsideInlineCode(plainText);
      plainText = "";
      fence = { character: openingFence[1][0], length: openingFence[1].length };
      output += line;
      continue;
    }
    plainText += line;
  }
  return output + escapeOutsideInlineCode(plainText);
}

// src/paste-handler.ts
function handleEditorPaste(event, view) {
  const target = event.target;
  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }
  const clipboardHtml = event.clipboardData?.getData("text/html");
  if (clipboardHtml) {
    return false;
  }
  const clipboardText = event.clipboardData?.getData("text/plain");
  if (typeof clipboardText !== "string") {
    return false;
  }
  const convertedText = escapeFootnoteReferences(clipboardText);
  if (convertedText === clipboardText) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  view.editor.replaceSelection(convertedText);
  return true;
}

// src/main.ts
var DEFAULT_SETTINGS = { escapeFootnoteReferences: true };
var WikiPastePlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
    this.addSettingTab(new WikiPasteSettingTab(this.app, this));
    this.registerDomEvent(document, "paste", (event) => {
      if (!this.settings.escapeFootnoteReferences) {
        return;
      }
      const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
      if (view) {
        handleEditorPaste(event, view);
      }
    }, { capture: true });
  }
  async setFootnoteEscapingEnabled(enabled) {
    this.settings.escapeFootnoteReferences = enabled;
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
    new import_obsidian.Setting(containerEl).setName("Escape footnote references").setDesc("Prevent copied [^label] text from being parsed as an Obsidian footnote.").addToggle((toggle) => toggle.setValue(this.plugin.settings.escapeFootnoteReferences).onChange((enabled) => this.plugin.setFootnoteEscapingEnabled(enabled)));
  }
};
