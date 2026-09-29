import { MarkdownView } from "obsidian";
import { escapeFootnoteReferences } from "./compatibility";

export function handleEditorPaste(event: ClipboardEvent, view: MarkdownView): boolean {
  const target = event.target as Element | null;

  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const clipboardHtml = event.clipboardData?.getData("text/html");

  if (clipboardHtml) {
    return false;
  }

  const clipboardText = event.clipboardData?.getData("text/plain");

  if (typeof clipboardText !== "string") {
    return false;
  }

  const convertedText = escapeFootnoteReferences(clipboardText);

  if (convertedText === clipboardText) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  view.editor.replaceSelection(convertedText);
  return true;
}
