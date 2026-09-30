// @machine:
// Loads and migrates settings, then registers a capture-phase paste listener.
// Delegates active MarkdownView events to md-editor-paste-handler.ts and persists changes.
import { MarkdownView, Plugin, PluginSettingTab, Setting, type App } from "obsidian";
import { handleEditorChange, handleEditorPaste } from "./md-editor-paste-handler";

interface WikiPasteSettings {
  escapeMarkdownSyntax: boolean;
}

interface StoredWikiPasteSettings extends Partial<WikiPasteSettings> {
  escapeFootnoteReferences?: boolean;
}

const DEFAULT_SETTINGS: WikiPasteSettings = { escapeMarkdownSyntax: true };

export default class WikiPastePlugin extends Plugin {
  settings!: WikiPasteSettings;

  async onload(): Promise<void> {
    const savedSettings = await this.loadData() as StoredWikiPasteSettings | null;
    this.settings = {
      escapeMarkdownSyntax: savedSettings?.escapeMarkdownSyntax
        ?? savedSettings?.escapeFootnoteReferences
        ?? DEFAULT_SETTINGS.escapeMarkdownSyntax,
    };
    this.addSettingTab(new WikiPasteSettingTab(this.app, this));

    this.registerDomEvent(document, "paste", (event: ClipboardEvent) => {
      if (!this.settings.escapeMarkdownSyntax) {
        return;
      }

      const view = this.app.workspace.getActiveViewOfType(MarkdownView);

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

  async setMarkdownEscapingEnabled(enabled: boolean): Promise<void> {
    this.settings.escapeMarkdownSyntax = enabled;
    await this.saveData(this.settings);
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
  }
}