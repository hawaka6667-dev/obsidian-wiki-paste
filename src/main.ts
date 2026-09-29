import { MarkdownView, Plugin, PluginSettingTab, Setting, type App } from "obsidian";
import { handleEditorPaste } from "./paste-handler";

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
      .setName("Preserve copied content on paste")
      .setDesc("Convert rich HTML clipboard content to Markdown and escape syntax in plain-text content.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.escapeMarkdownSyntax)
        .onChange((enabled) => this.plugin.setMarkdownEscapingEnabled(enabled)));
  }
}