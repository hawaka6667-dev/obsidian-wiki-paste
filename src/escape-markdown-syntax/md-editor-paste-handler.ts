// @machine:
// Handles paste events inside the active Obsidian Markdown editor.
// Tracks in-editor copies and cuts so matching Markdown pastes bypass webpage transformations.
// Converts web/AI LaTeX formulas, snapshots native rich pastes, and applies optional syntax escaping.
import type { Editor, MarkdownView } from "obsidian";
import { convertLatexDelimiters, convertWebHtmlWithLatex } from "../latex-paste/latex-paste";
import { escapeMarkdownSyntax, escapeObsidianSyntax } from "./md-syntax-escaping";

export interface EditorPasteOptions {
  escapeMarkdownSyntax?: boolean;
  convertLatexOnPaste?: boolean;
  htmlToMarkdown?: (element: HTMLElement) => string;
}

interface PendingHtmlPaste {
  value: string;
  selectionFrom: number;
  selectionTo: number;
  escapeMarkdownSyntax: boolean;
  convertLatexOnPaste: boolean;
}

const pendingHtmlPastes = new WeakMap<Editor, PendingHtmlPaste>();
const recentInternalMarkdownCopies = new WeakMap<Document, { text: string }>();

export function handleEditorCopy(event: ClipboardEvent, view: MarkdownView): boolean {
  return handleObsidianCopy(event, view.containerEl.ownerDocument, view);
}

export function handleEditorCut(event: ClipboardEvent, view?: MarkdownView): boolean {
  const target = event.target as Element | null;
  if (!view || !target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  return handleObsidianCopy(event, view.containerEl.ownerDocument, view);
}

export function handleObsidianCopy(event: ClipboardEvent, document: Document, view?: MarkdownView): boolean {
  recentInternalMarkdownCopies.delete(document);
  const target = event.target as Element | null;
  const clipboardText = event.clipboardData?.getData("text/plain") ?? "";
  const copiedText = clipboardText || (view && target?.closest?.(".cm-content") && view.containerEl.contains(target)
    ? view.editor.getSelection()
    : "");
  if (!copiedText) {
    return false;
  }

  recentInternalMarkdownCopies.set(document, { text: copiedText });
  return true;
}

export function clearRecentInternalMarkdownCopy(document: Document): void {
  recentInternalMarkdownCopies.delete(document);
}

export function consumeRecentInternalMarkdownCopy(document: Document, clipboardText: string | undefined): boolean {
  const recentCopy = recentInternalMarkdownCopies.get(document);
  if (!recentCopy) {
    return false;
  }

  recentInternalMarkdownCopies.delete(document);
  return clipboardText === recentCopy.text;
}

export function handleEditorPaste(
  event: ClipboardEvent,
  view: MarkdownView,
  options: EditorPasteOptions = {},
): boolean {
  const target = event.target as Element | null;

  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const shouldEscape = options.escapeMarkdownSyntax ?? true;
  const shouldConvertLatex = options.convertLatexOnPaste ?? false;
  if (!shouldEscape && !shouldConvertLatex) {
    return false;
  }

  const clipboardData = event.clipboardData;
  const clipboardText = clipboardData?.getData("text/plain");
  if (consumeRecentInternalMarkdownCopy(view.containerEl.ownerDocument, clipboardText)) {
    return false;
  }

  const clipboardHtml = clipboardData?.getData("text/html");

  if (clipboardHtml) {
    if (shouldConvertLatex && options.htmlToMarkdown) {
      const converted = convertWebHtmlWithLatex(
        clipboardHtml,
        view.containerEl.ownerDocument,
        options.htmlToMarkdown,
      );
      if (converted.hasMath) {
        const finalMarkdown = shouldEscape
          ? escapeObsidianSyntax(converted.markdown, { preserveLatex: true })
          : converted.markdown;
        event.preventDefault();
        event.stopPropagation();
        view.editor.replaceSelection(finalMarkdown);
        return true;
      }
    }

    const editor = view.editor;
    const pendingPaste: PendingHtmlPaste = {
      value: editor.getValue(),
      selectionFrom: editor.posToOffset(editor.getCursor("from")),
      selectionTo: editor.posToOffset(editor.getCursor("to")),
      escapeMarkdownSyntax: shouldEscape,
      convertLatexOnPaste: shouldConvertLatex,
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

  let convertedText = shouldConvertLatex ? convertLatexDelimiters(clipboardText) : clipboardText;
  if (shouldEscape) {
    convertedText = escapeMarkdownSyntax(convertedText, { preserveLatex: shouldConvertLatex });
  }

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
  let convertedText = pendingPaste.convertLatexOnPaste ? convertLatexDelimiters(insertedText) : insertedText;
  if (pendingPaste.escapeMarkdownSyntax) {
    convertedText = escapeObsidianSyntax(convertedText, { preserveLatex: pendingPaste.convertLatexOnPaste });
  }
  if (convertedText === insertedText) {
    return false;
  }

  editor.replaceRange(convertedText, editor.offsetToPos(changeStart), editor.offsetToPos(insertedEnd));
  return true;
}
