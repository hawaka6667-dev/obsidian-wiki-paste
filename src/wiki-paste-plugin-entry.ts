// @machine:
// Loads and migrates settings, tracks Markdown editor copy provenance, and registers paste listeners.
// Delegates Markdown and Canvas events to their handlers and persists settings changes.
import { MarkdownView, Plugin, PluginSettingTab, Setting, type App } from "obsidian";
import { handleCanvasMarkdownPaste, handleCanvasPaste } from "./auto-expand-canvas/canvas-auto-expand";
import {
  clearPendingCanvasMarkdown,
  handleCanvasCardClipboardEvent,
  handleCardMarkdownPaste,
} from "./card-copy-to-markdown/card-copy-to-markdown";
import {
  clearRecentInternalMarkdownCopy,
  handleEditorChange,
  handleObsidianCopy,
  handleEditorPaste,
} from "./escape-markdown-syntax/md-editor-paste-handler";

interface WikiPasteSettings {
  escapeMarkdownSyntax: boolean;
  autoExpandCanvasCards: boolean;
  canvasCardCopyToMarkdown: boolean;
}

interface StoredWikiPasteSettings extends Partial<WikiPasteSettings> {
  escapeFootnoteReferences?: boolean;
}

const DEFAULT_SETTINGS: WikiPasteSettings = {
  escapeMarkdownSyntax: true,
  autoExpandCanvasCards: true,
  canvasCardCopyToMarkdown: true,
};

export default class WikiPastePlugin extends Plugin {
  settings!: WikiPasteSettings;

  async onload(): Promise<void> {
    const savedSettings = await this.loadData() as StoredWikiPasteSettings | null;
    this.settings = {
      escapeMarkdownSyntax: savedSettings?.escapeMarkdownSyntax
        ?? savedSettings?.escapeFootnoteReferences
        ?? DEFAULT_SETTINGS.escapeMarkdownSyntax,
      autoExpandCanvasCards: savedSettings?.autoExpandCanvasCards ?? DEFAULT_SETTINGS.autoExpandCanvasCards,
      canvasCardCopyToMarkdown: savedSettings?.canvasCardCopyToMarkdown ?? DEFAULT_SETTINGS.canvasCardCopyToMarkdown,
    };
    this.addSettingTab(new WikiPasteSettingTab(this.app, this));

    this.registerDomEvent(document, "copy", (event: ClipboardEvent) => {
      if (this.settings.canvasCardCopyToMarkdown) {
        handleCanvasCardClipboardEvent(event, document, this.app.workspace.activeLeaf?.view);
      }
    }, { capture: true });
    this.registerDomEvent(document, "copy", (event: ClipboardEvent) => {
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      handleObsidianCopy(event, document, markdownView ?? undefined);
    });
    this.registerDomEvent(document, "cut", (event: ClipboardEvent) => {
      if (this.settings.canvasCardCopyToMarkdown) {
        handleCanvasCardClipboardEvent(event, document, this.app.workspace.activeLeaf?.view);
      }
    }, { capture: true });
    this.registerDomEvent(window, "blur", () => {
      clearRecentInternalMarkdownCopy(document);
      clearPendingCanvasMarkdown(document);
    });

    this.registerDomEvent(document, "paste", (event: ClipboardEvent) => {
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      const activeView = this.app.workspace.activeLeaf?.view;

      if (this.settings.canvasCardCopyToMarkdown && handleCardMarkdownPaste(event, document, markdownView)) {
        return;
      }

      if (this.settings.escapeMarkdownSyntax) {
        if (markdownView) {
          handleEditorPaste(event, markdownView);
        } else if (activeView) {
          handleCanvasMarkdownPaste(event, activeView);
        }
      }

      if (this.settings.autoExpandCanvasCards) {
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

  async setMarkdownEscapingEnabled(enabled: boolean): Promise<void> {
    this.settings.escapeMarkdownSyntax = enabled;
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

  onunload(): void {
    clearPendingCanvasMarkdown(document);
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

    new Setting(containerEl)
      .setName("Escape pasted Markdown syntax")
      .setDesc("Prevent Markdown and Obsidian syntax in plain-text pastes from being rendered as formatting.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.escapeMarkdownSyntax)
        .onChange((enabled) => this.plugin.setMarkdownEscapingEnabled(enabled)));

    new Setting(containerEl)
      .setName("Auto-expand pasted Canvas cards")
      .setDesc("Resize text cards after pasting so their content is visible.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoExpandCanvasCards)
        .onChange((enabled) => this.plugin.setCanvasAutoExpandEnabled(enabled)));

    new Setting(containerEl)
      .setName("Paste copied or cut Canvas cards to Markdown")
      .setDesc("Paste a single copied or cut Canvas text card as Markdown in the editor.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.canvasCardCopyToMarkdown)
        .onChange((enabled) => this.plugin.setCanvasCardCopyToMarkdownEnabled(enabled)));
  }
}