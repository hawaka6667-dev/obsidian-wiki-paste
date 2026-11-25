// @machine:
// Plugin entry point: loads/normalizes settings, registers clipboard/keyboard listeners, and delegates to feature modules.

import { htmlToMarkdown, MarkdownView, Menu, Platform, Plugin, type View } from "obsidian";
import { autoExpandCanvasNode, type CanvasAutoExpandNode } from "./auto-expand-canvas/canvas-auto-expand";
import { handleCanvasMarkdownPaste } from "./auto-expand-canvas/canvas-markdown-escape";
import { handleCanvasPaste } from "./auto-expand-canvas/canvas-paste";
import {
  clearPendingCanvasMarkdown,
  handleCanvasCardClipboardEvent,
  handleCardMarkdownPaste,
} from "./card-copy-to-markdown/card-copy-to-markdown";
import { handleMoveSelectedLinesKeydown } from "./editor-actions/move-selected-lines";
import { handleSelectLineThenAllKeydown } from "./editor-actions/select-line-then-all";
import {
  clearRecentInternalMarkdownCopy,
  handleEditorChange,
  handleEditorCut,
  handleEditorPaste,
  handleObsidianCopy,
} from "./escape-markdown-syntax/md-editor-paste-handler";
import { closePasteOptionsPopup, showPasteOptionsPopup } from "./paste-options/paste-options-popup";
import {
  clearRecentInternalHtmlCopy,
  pasteClipboardHtml,
  rememberInternalHtmlCopy,
} from "./paste-to-html/paste-to-html";
import {
  normalizeSettings,
  WikiPasteSettingTab,
  type StoredWikiPasteSettings,
  type WikiPasteSettings,
} from "./settings";
import { containerContainsTarget } from "./shared/editor-target";
import { openIssueReport } from "./shared/issue-report";

export default class WikiPastePlugin extends Plugin {
  settings!: WikiPasteSettings;
  private readonly observedDocuments = new WeakSet<Document>();
  private iframeObserver: MutationObserver | null = null;

  async onload(): Promise<void> {
    const savedSettings = await this.loadData() as StoredWikiPasteSettings | null;
    this.settings = normalizeSettings(savedSettings);
    this.addSettingTab(new WikiPasteSettingTab(this.app, this));

    this.addCommand({
      id: "submit-issue",
      name: "Submit issue / feedback on GitHub",
      callback: () => this.openIssueReportPage(),
    });

    this.attachDocumentListeners(document);
    this.observeCanvasIframes();

    this.registerDomEvent(window, "blur", () => {
      clearRecentInternalMarkdownCopy(document);
      clearRecentInternalHtmlCopy(document);
      clearPendingCanvasMarkdown(document);
    });

    this.registerEvent(this.app.workspace.on("editor-change", (editor) => {
      if (this.settings.escapeMarkdownSyntax || this.settings.convertLatexOnPaste) {
        handleEditorChange(editor);
      }
    }));
  }

  private attachDocumentListeners(targetDoc: Document): void {
    if (this.observedDocuments.has(targetDoc)) {
      return;
    }
    this.observedDocuments.add(targetDoc);

    this.registerDomEvent(targetDoc, "copy", (event: ClipboardEvent) => {
      if (this.settings.canvasCardCopyToMarkdown) {
        handleCanvasCardClipboardEvent(event, document, this.getCanvasView(event));
      }
    }, { capture: true });

    this.registerDomEvent(targetDoc, "copy", (event: ClipboardEvent) => {
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      handleObsidianCopy(event, document, markdownView ?? undefined);
      rememberInternalHtmlCopy(event, markdownView ?? undefined);
    });

    this.registerDomEvent(targetDoc, "cut", (event: ClipboardEvent) => {
      if (this.settings.canvasCardCopyToMarkdown) {
        handleCanvasCardClipboardEvent(event, document, this.getCanvasView(event));
      }
    }, { capture: true });

    this.registerDomEvent(targetDoc, "cut", (event: ClipboardEvent) => {
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      handleEditorCut(event, markdownView ?? undefined);
      rememberInternalHtmlCopy(event, markdownView ?? undefined);
    });

    this.registerDomEvent(targetDoc, "keydown", (event: KeyboardEvent) => {
      if (!this.settings.selectLineBeforeAll && !this.settings.moveLinesWithAltArrows) {
        return;
      }

      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      const activeView = markdownView ? undefined : this.getCanvasView(event);
      const fallbackEditor = this.app.workspace.activeEditor?.editor ?? null;

      if (
        this.settings.selectLineBeforeAll
        && handleSelectLineThenAllKeydown(event, markdownView, activeView, {
          isMacOS: Platform.isMacOS,
          fallbackEditor,
        })
      ) {
        return;
      }

      if (this.settings.moveLinesWithAltArrows) {
        handleMoveSelectedLinesKeydown(event, markdownView, activeView, fallbackEditor);
      }
    }, { capture: true });

    this.registerDomEvent(targetDoc, "paste", (event: ClipboardEvent) => {
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
  }

  private attachIframeDocument(iframe: HTMLIFrameElement): void {
    const attach = () => {
      try {
        if (iframe.contentDocument) {
          this.attachDocumentListeners(iframe.contentDocument);
        }
      } catch {
        // Ignore cross-origin iframes.
      }
    };

    attach();
    this.registerDomEvent(iframe, "load", attach);
  }

  private observeCanvasIframes(): void {
    for (const iframe of Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe.embed-iframe"))) {
      this.attachIframeDocument(iframe);
    }

    this.iframeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLIFrameElement && node.classList.contains("embed-iframe")) {
            this.attachIframeDocument(node);
          } else if (node instanceof HTMLElement) {
            for (const nested of Array.from(node.querySelectorAll<HTMLIFrameElement>("iframe.embed-iframe"))) {
              this.attachIframeDocument(nested);
            }
          }
        }
      }
    });
    this.iframeObserver.observe(document.body, { childList: true, subtree: true });
  }

  openIssueReportPage(): void {
    const platformLabel = Platform.isMacOS
      ? "macOS"
      : Platform.isWin
        ? "Windows"
        : Platform.isLinux
          ? "Linux"
          : Platform.isMobile
            ? "Mobile"
            : "Desktop";
    openIssueReport({
      pluginVersion: this.manifest.version,
      platformLabel,
      settings: this.settings,
    });
  }

  async updateSetting<K extends keyof WikiPasteSettings>(key: K, value: WikiPasteSettings[K]): Promise<void> {
    this.settings[key] = value;
    if (key === "canvasCardCopyToMarkdown" && !value) {
      clearPendingCanvasMarkdown(document);
    }
    if (key === "showPasteOptionsPopup" && !value) {
      closePasteOptionsPopup(document);
    }
    await this.saveData(this.settings);
  }

  private getCanvasView(event: Event): View | undefined {
    const target = event.target as Node | null;
    const canvasLeaves = this.app.workspace.getLeavesOfType("canvas");
    if (target) {
      const matchingLeaf = canvasLeaves.find((leaf) => containerContainsTarget(leaf.view.containerEl, target));
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
    this.iframeObserver?.disconnect();
    this.iframeObserver = null;
    clearRecentInternalHtmlCopy(document);
    clearPendingCanvasMarkdown(document);
    closePasteOptionsPopup(document);
  }
}
