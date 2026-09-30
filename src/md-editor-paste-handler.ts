// @machine:
// Handles paste events inside the active Obsidian Markdown editor.
// Snapshots rich pastes and post-processes Obsidian's inserted Markdown on editor-change.
// Plain text is escaped before insertion; native Markdown formatting and tables are preserved.
import type { Editor, MarkdownView } from "obsidian";
import { escapeMarkdownSyntax, escapeObsidianSyntax } from "./md-syntax-escaping";

interface PendingHtmlPaste {
  value: string;
  selectionFrom: number;
  selectionTo: number;
}

const pendingHtmlPastes = new WeakMap<Editor, PendingHtmlPaste>();

export function handleEditorPaste(event: ClipboardEvent, view: MarkdownView): boolean {
  const target = event.target as Element | null;

  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const clipboardHtml = event.clipboardData?.getData("text/html");

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

  const clipboardText = event.clipboardData?.getData("text/plain");

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
