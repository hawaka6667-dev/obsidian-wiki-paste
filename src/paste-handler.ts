import { MarkdownView } from "obsidian";
import { escapeMarkdownSyntax } from "./compatibility";
import { htmlToMarkdown } from "./html-to-markdown";

export function handleEditorPaste(event: ClipboardEvent, view: MarkdownView): boolean {
  const target = event.target as Element | null;

  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const clipboardHtml = event.clipboardData?.getData("text/html");
  const clipboardText = event.clipboardData?.getData("text/plain");

  if (!clipboardHtml && typeof clipboardText !== "string") {
    return false;
  }

  const convertedText = clipboardHtml
    ? htmlToMarkdown(clipboardHtml)
    : escapeMarkdownSyntax(clipboardText!);

  if (!convertedText || convertedText === clipboardText) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  view.editor.replaceSelection(convertedText);
  return true;
}
