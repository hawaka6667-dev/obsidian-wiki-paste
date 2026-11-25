// @machine:
// Defines plugin settings schema, migration defaults, and the Obsidian PluginSettingTab UI.
// Separates stable features from [Hack] legacy/experimental toggles (which default to false).

import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";

export interface WikiPasteSettings {
  escapeMarkdownSyntax: boolean;
  convertLatexOnPaste: boolean;
  autoExpandCanvasCards: boolean;
  canvasCardCopyToMarkdown: boolean;
  selectLineBeforeAll: boolean;
  moveLinesWithAltArrows: boolean;
  showPasteOptionsPopup: boolean;
  pasteWebContentAsHtml: boolean;
}

export interface StoredWikiPasteSettings extends Partial<WikiPasteSettings> {
  escapeFootnoteReferences?: boolean;
}

export const DEFAULT_SETTINGS: WikiPasteSettings = {
  escapeMarkdownSyntax: false,
  convertLatexOnPaste: true,
  autoExpandCanvasCards: true,
  canvasCardCopyToMarkdown: true,
  selectLineBeforeAll: true,
  moveLinesWithAltArrows: true,
  showPasteOptionsPopup: false,
  pasteWebContentAsHtml: false,
};

export function normalizeSettings(saved: StoredWikiPasteSettings | null): WikiPasteSettings {
  return {
    escapeMarkdownSyntax: saved?.escapeMarkdownSyntax
      ?? saved?.escapeFootnoteReferences
      ?? DEFAULT_SETTINGS.escapeMarkdownSyntax,
    convertLatexOnPaste: saved?.convertLatexOnPaste ?? DEFAULT_SETTINGS.convertLatexOnPaste,
    autoExpandCanvasCards: saved?.autoExpandCanvasCards ?? DEFAULT_SETTINGS.autoExpandCanvasCards,
    canvasCardCopyToMarkdown: saved?.canvasCardCopyToMarkdown ?? DEFAULT_SETTINGS.canvasCardCopyToMarkdown,
    selectLineBeforeAll: saved?.selectLineBeforeAll ?? DEFAULT_SETTINGS.selectLineBeforeAll,
    moveLinesWithAltArrows: saved?.moveLinesWithAltArrows ?? DEFAULT_SETTINGS.moveLinesWithAltArrows,
    showPasteOptionsPopup: saved?.showPasteOptionsPopup ?? DEFAULT_SETTINGS.showPasteOptionsPopup,
    pasteWebContentAsHtml: saved?.pasteWebContentAsHtml ?? DEFAULT_SETTINGS.pasteWebContentAsHtml,
  };
}

export interface WikiPastePluginHost extends Plugin {
  settings: WikiPasteSettings;
  updateSetting<K extends keyof WikiPasteSettings>(key: K, value: WikiPasteSettings[K]): Promise<void>;
  openIssueReportPage(): void;
}

export class WikiPasteSettingTab extends PluginSettingTab {
  private readonly plugin: WikiPastePluginHost;

  constructor(app: App, plugin: WikiPastePluginHost) {
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

    this.addToggle(
      "Convert and preserve pasted LaTeX",
      "Convert copied web/AI math formulas and \\(...\\) / \\[...\\] delimiters to $...$ and $$...$$, and keep LaTeX unescaped.",
      "convertLatexOnPaste",
    );
    this.addToggle(
      "Auto-expand pasted Canvas cards",
      "Resize text cards after pasting so their content is visible.",
      "autoExpandCanvasCards",
    );
    this.addToggle(
      "Paste copied or cut Canvas cards to Markdown / Canvas card",
      "Paste a single copied or cut Canvas text card as Markdown into the editor or another Canvas card.",
      "canvasCardCopyToMarkdown",
    );
    this.addToggle(
      "OneNote-style Ctrl+A (select line, then all)",
      "First Ctrl+A selects the current line in the editor; pressing Ctrl+A again selects the entire note.",
      "selectLineBeforeAll",
    );
    this.addToggle(
      "Move selected lines with Alt+Up/Down",
      "Move and swap the current line or selected lines up or down using Alt+ArrowUp and Alt+ArrowDown.",
      "moveLinesWithAltArrows",
    );
    this.addToggle(
      "[Hack] Escape pasted Markdown syntax",
      "Legacy / incomplete: prevent Markdown and Obsidian syntax in plain-text pastes from being rendered as formatting.",
      "escapeMarkdownSyntax",
    );
    this.addToggle(
      "[Hack] Show paste options popup",
      "Incomplete prototype: show a Word-style paste options menu after pasting in the Markdown editor. Options are visual only.",
      "showPasteOptionsPopup",
    );
    this.addToggle(
      "[Hack] Paste web content as raw HTML",
      "Experimental / incomplete: insert webpage HTML unchanged in the Markdown editor instead of using Obsidian's conversion.",
      "pasteWebContentAsHtml",
    );

    new Setting(containerEl).setName("Support & feedback").setHeading();
    new Setting(containerEl)
      .setName("Submit an issue")
      .setDesc("Open GitHub Issues with your plugin version and enabled options pre-filled.")
      .addButton((button) => button
        .setButtonText("Report issue")
        .onClick(() => this.plugin.openIssueReportPage()));
  }

  private addToggle(name: string, desc: string, key: keyof WikiPasteSettings): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings[key])
        .onChange((enabled) => this.plugin.updateSetting(key, enabled)));
  }
}
