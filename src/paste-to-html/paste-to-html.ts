// @machine:
// Handles option-enabled webpage HTML paste in the Markdown editor.
// Preserves internal Obsidian copies and inserts external clipboard HTML unchanged.
//纯html

import type { MarkdownView } from "obsidian";

const recentInternalCopies = new WeakMap<Document, { text: string }>();

export function rememberInternalHtmlCopy(event: ClipboardEvent, view?: MarkdownView): void {
  const target = event.target as Element | null;
  const document = view?.containerEl.ownerDocument ?? target?.ownerDocument;
  if (!document) {
    return;
  }

  recentInternalCopies.delete(document);
  if (!view || !target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return;
  }

  const clipboardText = event.clipboardData?.getData("text/plain") ?? "";
  const copiedText = clipboardText || view.editor.getSelection();
  if (copiedText) {
    recentInternalCopies.set(document, { text: copiedText });
  }
}

export function clearRecentInternalHtmlCopy(document: Document): void {
  recentInternalCopies.delete(document);
}

export function pasteClipboardHtml(event: ClipboardEvent, view: MarkdownView): boolean {
  const target = event.target as Element | null;
  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const clipboardData = event.clipboardData;
  const clipboardText = clipboardData?.getData("text/plain");
  const internalCopy = recentInternalCopies.get(view.containerEl.ownerDocument);
  if (internalCopy) {
    recentInternalCopies.delete(view.containerEl.ownerDocument);
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
  // const cleanedHtml = cleanHtml(html, view.containerEl.ownerDocument);
  view.editor.replaceSelection(html);
  return true;
}
