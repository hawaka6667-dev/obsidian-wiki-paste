// @machine:
// Loads and migrates settings, tracks Markdown editor copy/cut provenance, and registers paste listeners.
// Delegates Markdown and Canvas events to their handlers and persists settings changes.
import { htmlToMarkdown, MarkdownView, Menu, Plugin, PluginSettingTab, Setting, type App, type View } from "obsidian";
import { autoExpandCanvasNode, type CanvasAutoExpandNode } from "./auto-expand-canvas/canvas-auto-expand";
import { handleCanvasPaste } from "./auto-expand-canvas/canvas-paste";
import { handleCanvasMarkdownPaste } from "./auto-expand-canvas/canvas-markdown-escape";
import {
  clearPendingCanvasMarkdown,
  handleCanvasCardClipboardEvent,
  handleCardMarkdownPaste,
} from "./card-copy-to-markdown/card-copy-to-markdown";
import {
  clearRecentInternalMarkdownCopy,
  handleEditorCut,
  handleEditorChange,
  handleObsidianCopy,
  handleEditorPaste,
} from "./escape-markdown-syntax/md-editor-paste-handler";
import { closePasteOptionsPopup, showPasteOptionsPopup } from "./paste-options/paste-options-popup";
import {
  clearRecentInternalHtmlCopy,
  pasteClipboardHtml,
  rememberInternalHtmlCopy,
} from "./paste-to-html/paste-to-html";

interface WikiPasteSettings {
  escapeMarkdownSyntax: boolean;
  convertLatexOnPaste: boolean;
  autoExpandCanvasCards: boolean;
  canvasCardCopyToMarkdown: boolean;
  showPasteOptionsPopup: boolean;
  pasteWebContentAsHtml: boolean;
}

interface StoredWikiPasteSettings extends Partial<WikiPasteSettings> {
  escapeFootnoteReferences?: boolean;
}

const DEFAULT_SETTINGS: WikiPasteSettings = {
  escapeMarkdownSyntax: false,
  convertLatexOnPaste: true,
  autoExpandCanvasCards: true,
  canvasCardCopyToMarkdown: true,
  showPasteOptionsPopup: false,
  pasteWebContentAsHtml: false,
};

export default class WikiPastePlugin extends Plugin {
  settings!: WikiPasteSettings;

  async onload(): Promise<void> {
    const savedSettings = await this.loadData() as StoredWikiPasteSettings | null;
    this.settings = {
      escapeMarkdownSyntax: savedSettings?.escapeMarkdownSyntax
        ?? savedSettings?.escapeFootnoteReferences
        ?? DEFAULT_SETTINGS.escapeMarkdownSyntax,
      convertLatexOnPaste: savedSettings?.convertLatexOnPaste ?? DEFAULT_SETTINGS.convertLatexOnPaste,
      autoExpandCanvasCards: savedSettings?.autoExpandCanvasCards ?? DEFAULT_SETTINGS.autoExpandCanvasCards,
      canvasCardCopyToMarkdown: savedSettings?.canvasCardCopyToMarkdown ?? DEFAULT_SETTINGS.canvasCardCopyToMarkdown,
      showPasteOptionsPopup: savedSettings?.showPasteOptionsPopup ?? DEFAULT_SETTINGS.showPasteOptionsPopup,
      pasteWebContentAsHtml: savedSettings?.pasteWebContentAsHtml ?? DEFAULT_SETTINGS.pasteWebContentAsHtml,
    };
    this.addSettingTab(new WikiPasteSettingTab(this.app, this));

    this.registerDomEvent(document, "copy", (event: ClipboardEvent) => {
      if (this.settings.canvasCardCopyToMarkdown) {
        handleCanvasCardClipboardEvent(event, document, this.getCanvasView(event));
      }
    }, { capture: true });
    this.registerDomEvent(document, "copy", (event: ClipboardEvent) => {
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      handleObsidianCopy(event, document, markdownView ?? undefined);
    });
    this.registerDomEvent(document, "copy", (event: ClipboardEvent) => {
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      rememberInternalHtmlCopy(event, markdownView ?? undefined);
    });
    this.registerDomEvent(document, "cut", (event: ClipboardEvent) => {
      if (this.settings.canvasCardCopyToMarkdown) {
        handleCanvasCardClipboardEvent(event, document, this.getCanvasView(event));
      }
    }, { capture: true });
    this.registerDomEvent(document, "cut", (event: ClipboardEvent) => {
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      handleEditorCut(event, markdownView ?? undefined);
    });
    this.registerDomEvent(document, "cut", (event: ClipboardEvent) => {
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      rememberInternalHtmlCopy(event, markdownView ?? undefined);
    });
    this.registerDomEvent(window, "blur", () => {
      clearRecentInternalMarkdownCopy(document);
      clearRecentInternalHtmlCopy(document);
      clearPendingCanvasMarkdown(document);
    });

    this.registerDomEvent(document, "paste", (event: ClipboardEvent) => {
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      const activeView = markdownView ? undefined : this.getCanvasView(event);

      if (this.settings.showPasteOptionsPopup && markdownView) {
        this.schedulePasteOptionsPopup(markdownView, event);
      }

      if (this.settings.canvasCardCopyToMarkdown && handleCardMarkdownPaste(
        event,
        document,
        markdownView,
        activeView,
        (node) => {
          if (this.settings.autoExpandCanvasCards && node.nodeEl && node.canvas && node.getData && node.setData) {
            window.requestAnimationFrame(() => void autoExpandCanvasNode(node as CanvasAutoExpandNode));
          }
        },
      )) {
        return;
      }

      if (this.settings.pasteWebContentAsHtml && markdownView && pasteClipboardHtml(event, markdownView)) {
        return;
      }

      if (this.settings.escapeMarkdownSyntax || this.settings.convertLatexOnPaste) {
        const pasteOptions = {
          escapeMarkdownSyntax: this.settings.escapeMarkdownSyntax,
          convertLatexOnPaste: this.settings.convertLatexOnPaste,
          htmlToMarkdown,
        };
        if (markdownView) {
          handleEditorPaste(event, markdownView, pasteOptions);
        } else if (activeView) {
          handleCanvasMarkdownPaste(event, activeView, pasteOptions);
        }
      }

      if (this.settings.autoExpandCanvasCards && activeView) {
        handleCanvasPaste(event, activeView);
      }
    }, { capture: true });

    this.registerEvent(this.app.workspace.on("editor-change", (editor) => {
      if (this.settings.escapeMarkdownSyntax || this.settings.convertLatexOnPaste) {
        handleEditorChange(editor);
      }
    }));
  }

  async setMarkdownEscapingEnabled(enabled: boolean): Promise<void> {
    this.settings.escapeMarkdownSyntax = enabled;
    await this.saveData(this.settings);
  }

  async setConvertLatexOnPasteEnabled(enabled: boolean): Promise<void> {
    this.settings.convertLatexOnPaste = enabled;
    await this.saveData(this.settings);
  }

  async setCanvasAutoExpandEnabled(enabled: boolean): Promise<void> {
    this.settings.autoExpandCanvasCards = enabled;
    await this.saveData(this.settings);
  }

  async setCanvasCardCopyToMarkdownEnabled(enabled: boolean): Promise<void> {
    this.settings.canvasCardCopyToMarkdown = enabled;
    if (!enabled) {
      clearPendingCanvasMarkdown(document);
    }
    await this.saveData(this.settings);
  }

  async setPasteOptionsPopupEnabled(enabled: boolean): Promise<void> {
    this.settings.showPasteOptionsPopup = enabled;
    if (!enabled) {
      closePasteOptionsPopup(document);
    }
    await this.saveData(this.settings);
  }

  private getCanvasView(event: ClipboardEvent): View | undefined {
    const target = event.target as Node | null;
    const canvasLeaves = this.app.workspace.getLeavesOfType("canvas");
    if (target) {
      const matchingLeaf = canvasLeaves.find((leaf) => leaf.view.containerEl.contains(target));
      if (matchingLeaf) {
        return matchingLeaf.view;
      }
    }

    const recentLeaf = this.app.workspace.getMostRecentLeaf();
    return recentLeaf?.view?.getViewType() === "canvas" ? recentLeaf.view : undefined;
  }

  private schedulePasteOptionsPopup(view: MarkdownView, event: ClipboardEvent): void {
    const target = event.target as Element | null;
    if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
      return;
    }

    window.requestAnimationFrame(() => showPasteOptionsPopup(view.containerEl, Menu));
  }

  onunload(): void {
    clearRecentInternalHtmlCopy(document);
    clearPendingCanvasMarkdown(document);
    closePasteOptionsPopup(document);
  }
}

class WikiPasteSettingTab extends PluginSettingTab {
  private readonly plugin: WikiPastePlugin;

  constructor(app: App, plugin: WikiPastePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const { manifest } = this.plugin;
    new Setting(containerEl).setName(manifest.name).setHeading();
    containerEl.createEl("p", { text: manifest.description });
    containerEl.createEl("p", {
      text: `Version ${manifest.version} | Plugin ID: ${manifest.id} | Requires Obsidian ${manifest.minAppVersion}+ | By ${manifest.author}`,
    });

    new Setting(containerEl)
      .setName("[Hack] Escape pasted Markdown syntax")
      .setDesc("Legacy / incomplete: prevent Markdown and Obsidian syntax in plain-text pastes from being rendered as formatting.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.escapeMarkdownSyntax)
        .onChange((enabled) => this.plugin.setMarkdownEscapingEnabled(enabled)));

    new Setting(containerEl)
      .setName("Convert and preserve pasted LaTeX")
      .setDesc("Convert copied web/AI math formulas and \\(...\\) / \\[...\\] delimiters to $...$ and $$...$$, and keep LaTeX unescaped.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.convertLatexOnPaste)
        .onChange((enabled) => this.plugin.setConvertLatexOnPasteEnabled(enabled)));

    new Setting(containerEl)
      .setName("Auto-expand pasted Canvas cards")
      .setDesc("Resize text cards after pasting so their content is visible.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoExpandCanvasCards)
        .onChange((enabled) => this.plugin.setCanvasAutoExpandEnabled(enabled)));

    new Setting(containerEl)
      .setName("Paste copied or cut Canvas cards to Markdown / Canvas card")
      .setDesc("Paste a single copied or cut Canvas text card as Markdown into the editor or another Canvas card.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.canvasCardCopyToMarkdown)
        .onChange((enabled) => this.plugin.setCanvasCardCopyToMarkdownEnabled(enabled)));

    new Setting(containerEl)
      .setName("[Hack] Show paste options popup")
      .setDesc("Incomplete prototype: show a Word-style paste options menu after pasting in the Markdown editor. Options are visual only.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showPasteOptionsPopup)
        .onChange((enabled) => this.plugin.setPasteOptionsPopupEnabled(enabled)));

    new Setting(containerEl)
      .setName("[Hack] Paste web content as raw HTML")
      .setDesc("Experimental / incomplete: insert webpage HTML unchanged in the Markdown editor instead of using Obsidian's conversion.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.pasteWebContentAsHtml)
        .onChange(async (enabled) => {
          this.plugin.settings.pasteWebContentAsHtml = enabled;
          await this.plugin.saveData(this.plugin.settings);
        }));

  }
}