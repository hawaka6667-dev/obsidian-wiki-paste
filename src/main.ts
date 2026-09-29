import { MarkdownView, Plugin, PluginSettingTab, Setting, type App } from "obsidian";
import { handleEditorPaste } from "./paste-handler";

interface WikiPasteSettings {
  escapeFootnoteReferences: boolean;
}

const DEFAULT_SETTINGS: WikiPasteSettings = { escapeFootnoteReferences: true };

export default class WikiPastePlugin extends Plugin {
  settings!: WikiPasteSettings;

  async onload(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
    this.addSettingTab(new WikiPasteSettingTab(this.app, this));

    this.registerDomEvent(document, "paste", (event: ClipboardEvent) => {
      if (!this.settings.escapeFootnoteReferences) {
        return;
      }

      const view = this.app.workspace.getActiveViewOfType(MarkdownView);

      if (view) {
        handleEditorPaste(event, view);
      }
    }, { capture: true });
  }

  async setFootnoteEscapingEnabled(enabled: boolean): Promise<void> {
    this.settings.escapeFootnoteReferences = enabled;
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
      .setName("Escape footnote references")
      .setDesc("Prevent copied [^label] text from being parsed as an Obsidian footnote.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.escapeFootnoteReferences)
        .onChange((enabled) => this.plugin.setFootnoteEscapingEnabled(enabled)));
  }
}