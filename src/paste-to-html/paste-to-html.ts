// @machine:
// Captures rich clipboard HTML and can replace the corresponding native editor paste on request.
// Uses html-cleaner for output and rejects replacement if surrounding editor content changed.

import type { Editor, MarkdownView } from "obsidian";
import { cleanHtml } from "./html-cleaner";

interface PendingHtmlPaste {
  document: Document;
  html: string;
  originalValue: string;
  selectionFrom: number;
  selectionTo: number;
  insertedFrom?: number;
  insertedTo?: number;
}

const pendingHtmlPastes = new WeakMap<Editor, PendingHtmlPaste>();

export function capturePasteToHtml(event: ClipboardEvent, view: MarkdownView): boolean {
  const target = event.target as Element | null;
  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const html = event.clipboardData?.getData("text/html");
  if (!html) {
    return false;
  }

  const editor = view.editor;
  const pendingPaste: PendingHtmlPaste = {
    document: view.containerEl.ownerDocument,
    html,
    originalValue: editor.getValue(),
    selectionFrom: editor.posToOffset(editor.getCursor("from")),
    selectionTo: editor.posToOffset(editor.getCursor("to")),
  };
  pendingHtmlPastes.set(editor, pendingPaste);
  setTimeout(() => {
    if (pendingHtmlPastes.get(editor) === pendingPaste) {
      pendingHtmlPastes.delete(editor);
    }
  }, 30_000);
  return true;
}

export function trackPasteToHtmlEditorChange(editor: Editor): boolean {
  const pendingPaste = pendingHtmlPastes.get(editor);
  if (!pendingPaste) {
    return false;
  }

  const currentValue = editor.getValue();
  const insertedTo = editor.posToOffset(editor.getCursor("head"));
  if (
    currentValue === pendingPaste.originalValue
    || insertedTo < pendingPaste.selectionFrom
    || currentValue.slice(0, pendingPaste.selectionFrom)
      !== pendingPaste.originalValue.slice(0, pendingPaste.selectionFrom)
    || currentValue.slice(insertedTo)
      !== pendingPaste.originalValue.slice(pendingPaste.selectionTo)
  ) {
    pendingHtmlPastes.delete(editor);
    return false;
  }

  pendingPaste.insertedFrom = pendingPaste.selectionFrom;
  pendingPaste.insertedTo = insertedTo;
  return true;
}

export function pasteToHtml(editor: Editor): boolean {
  const pendingPaste = pendingHtmlPastes.get(editor);
  if (pendingPaste?.insertedFrom === undefined || pendingPaste.insertedTo === undefined) {
    return false;
  }

  const currentValue = editor.getValue();
  if (
    currentValue.slice(0, pendingPaste.insertedFrom)
      !== pendingPaste.originalValue.slice(0, pendingPaste.selectionFrom)
    || currentValue.slice(pendingPaste.insertedTo)
      !== pendingPaste.originalValue.slice(pendingPaste.selectionTo)
  ) {
    pendingHtmlPastes.delete(editor);
    return false;
  }

  const cleanedHtml = cleanHtml(pendingPaste.html, pendingPaste.document);
  if (!cleanedHtml) {
    pendingHtmlPastes.delete(editor);
    return false;
  }

  editor.replaceRange(
    cleanedHtml,
    editor.offsetToPos(pendingPaste.insertedFrom),
    editor.offsetToPos(pendingPaste.insertedTo),
  );
  pendingHtmlPastes.delete(editor);
  return true;
}