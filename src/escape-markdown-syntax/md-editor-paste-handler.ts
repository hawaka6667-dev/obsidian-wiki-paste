// @machine:
// Handles paste events inside the active Obsidian Markdown editor.
// Tracks in-editor copies so matching Markdown pastes bypass webpage syntax escaping.
// Snapshots external rich pastes and post-processes Obsidian's conversion on editor-change.
import type { Editor, MarkdownView } from "obsidian";
import { escapeMarkdownSyntax, escapeObsidianSyntax } from "./md-syntax-escaping";

interface PendingHtmlPaste {
  value: string;
  selectionFrom: number;
  selectionTo: number;
}

const pendingHtmlPastes = new WeakMap<Editor, PendingHtmlPaste>();
const recentInternalMarkdownCopies = new WeakMap<Document, { text: string; copiedAt: number }>();
const internalCopyLifetimeMs = 10_000;

export function handleEditorCopy(event: ClipboardEvent, view: MarkdownView): boolean {
  const document = view.containerEl.ownerDocument;
  recentInternalMarkdownCopies.delete(document);

  const target = event.target as Element | null;
  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const clipboardText = event.clipboardData?.getData("text/plain");
  const copiedText = clipboardText || view.editor.getSelection();
  if (!copiedText) {
    return false;
  }

  recentInternalMarkdownCopies.set(document, { text: copiedText, copiedAt: Date.now() });
  return true;
}

export function clearRecentInternalMarkdownCopy(document: Document): void {
  recentInternalMarkdownCopies.delete(document);
}

function consumeRecentInternalMarkdownCopy(document: Document, clipboardText: string | undefined): boolean {
  const recentCopy = recentInternalMarkdownCopies.get(document);
  if (!recentCopy) {
    return false;
  }

  recentInternalMarkdownCopies.delete(document);
  const age = Date.now() - recentCopy.copiedAt;
  return clipboardText === recentCopy.text && age >= 0 && age <= internalCopyLifetimeMs;
}

export function handleEditorPaste(event: ClipboardEvent, view: MarkdownView): boolean {
  const target = event.target as Element | null;

  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const clipboardData = event.clipboardData;
  const clipboardText = clipboardData?.getData("text/plain");
  if (consumeRecentInternalMarkdownCopy(view.containerEl.ownerDocument, clipboardText)) {
    return false;
  }

  const clipboardHtml = clipboardData?.getData("text/html");

  if (clipboardHtml) {
    const editor = view.editor;
    const pendingPaste: PendingHtmlPaste = {
      value: editor.getValue(),
      selectionFrom: editor.posToOffset(editor.getCursor("from")),
      selectionTo: editor.posToOffset(editor.getCursor("to")),
    };
    pendingHtmlPastes.set(editor, pendingPaste);
    setTimeout(() => {
      if (pendingHtmlPastes.get(editor) === pendingPaste) {
        pendingHtmlPastes.delete(editor);
      }
    }, 0);
    return false;
  }

  if (typeof clipboardText !== "string") {
    return false;
  }

  const convertedText = escapeMarkdownSyntax(clipboardText);

  if (convertedText === clipboardText) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  view.editor.replaceSelection(convertedText);
  return true;
}

export function handleEditorChange(editor: Editor): boolean {
  const pendingPaste = pendingHtmlPastes.get(editor);
  if (!pendingPaste) {
    return false;
  }
  pendingHtmlPastes.delete(editor);

  const currentValue = editor.getValue();
  if (currentValue === pendingPaste.value) {
    return false;
  }

  const changeStart = pendingPaste.selectionFrom;
  const insertedEnd = editor.posToOffset(editor.getCursor("head"));
  if (
    insertedEnd < changeStart
    || currentValue.slice(0, changeStart) !== pendingPaste.value.slice(0, changeStart)
    || currentValue.slice(insertedEnd) !== pendingPaste.value.slice(pendingPaste.selectionTo)
  ) {
    return false;
  }

  const insertedText = currentValue.slice(changeStart, insertedEnd);
  const convertedText = escapeObsidianSyntax(insertedText);
  if (convertedText === insertedText) {
    return false;
  }

  editor.replaceRange(convertedText, editor.offsetToPos(changeStart), editor.offsetToPos(insertedEnd));
  return true;
}
