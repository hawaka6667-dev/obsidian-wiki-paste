// @machine:
// Handles external rich-HTML paste directly in the Markdown editor.
// Preserves Obsidian's native paste when the clipboard has no HTML or the target is not an editor.

import type { MarkdownView } from "obsidian";
import { cleanHtml } from "./html-cleaner";

const recentInternalMarkdownCopies = new WeakMap<Document, { text: string }>();

export function rememberPasteToHtmlCopy(event: ClipboardEvent, view?: MarkdownView): boolean {
  const target = event.target as Element | null;
  const document = view?.containerEl.ownerDocument ?? target?.ownerDocument;
  if (!document) {
    return false;
  }

  recentInternalMarkdownCopies.delete(document);
  if (!view || !target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const clipboardText = event.clipboardData?.getData("text/plain") ?? "";
  const copiedText = clipboardText || view.editor.getSelection();
  if (!copiedText) {
    return false;
  }

  recentInternalMarkdownCopies.set(document, { text: copiedText });
  return true;
}

export function clearPasteToHtmlCopy(document: Document): void {
  recentInternalMarkdownCopies.delete(document);
}

export function pasteAsCleanHtml(event: ClipboardEvent, view: MarkdownView): boolean {
  const target = event.target as Element | null;
  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const clipboardData = event.clipboardData;
  const clipboardText = clipboardData?.getData("text/plain");
  const internalCopy = recentInternalMarkdownCopies.get(view.containerEl.ownerDocument);
  if (internalCopy) {
    recentInternalMarkdownCopies.delete(view.containerEl.ownerDocument);
    if (clipboardText === internalCopy.text) {
      return false;
    }
  }

  const html = clipboardData?.getData("text/html");
  if (!html) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  const cleanedHtml = cleanHtml(html, view.containerEl.ownerDocument);
  if (cleanedHtml) {
    view.editor.replaceSelection(cleanedHtml);
  }
  return true;
}