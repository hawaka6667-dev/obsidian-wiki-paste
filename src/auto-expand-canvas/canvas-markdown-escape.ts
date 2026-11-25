// @machine:
// Applies LaTeX conversion and Markdown escaping to Canvas text nodes changed by native paste.
// Extracts web/AI math HTML when available, converts \(...\) / \[...\] delimiters, and skips internal Obsidian copies.
import {
  consumeRecentInternalMarkdownCopy,
  type EditorPasteOptions,
} from "../escape-markdown-syntax/md-editor-paste-handler";
import { escapeMarkdownSyntax, escapeObsidianSyntax } from "../escape-markdown-syntax/md-syntax-escaping";
import { convertLatexDelimiters, convertWebHtmlWithLatex } from "../latex-paste/latex-paste";
import { isCanvasView } from "../shared/editor-target";

function replaceInsertedTextDiff(beforeText: string, afterText: string, replacement: string): string {
  let prefixLength = 0;
  const minLength = Math.min(beforeText.length, afterText.length);
  while (prefixLength < minLength && beforeText[prefixLength] === afterText[prefixLength]) {
    prefixLength += 1;
  }

  let beforeSuffix = beforeText.length;
  let afterSuffix = afterText.length;
  while (
    beforeSuffix > prefixLength
    && afterSuffix > prefixLength
    && beforeText[beforeSuffix - 1] === afterText[afterSuffix - 1]
  ) {
    beforeSuffix -= 1;
    afterSuffix -= 1;
  }

  return `${afterText.slice(0, prefixLength)}${replacement}${afterText.slice(afterSuffix)}`;
}

export function handleCanvasMarkdownPaste(
  event: ClipboardEvent,
  view: unknown,
  options: EditorPasteOptions = {},
): boolean {
  if (!isCanvasView(view) || !(view.canvas.nodes instanceof Map)) {
    return false;
  }

  const shouldEscape = options.escapeMarkdownSyntax ?? true;
  const shouldConvertLatex = options.convertLatexOnPaste ?? false;
  if (!shouldEscape && !shouldConvertLatex) {
    return false;
  }

  const clipboard = event.clipboardData;
  const clipboardText = clipboard?.getData("text/plain");
  const clipboardHtml = clipboard?.getData("text/html");
  if (!clipboardText && !clipboardHtml) {
    return false;
  }

  const doc = view.containerEl?.ownerDocument ?? document;
  const isInternalCopy = consumeRecentInternalMarkdownCopy(doc, clipboardText);
  const htmlMathResult = !isInternalCopy && clipboardHtml && shouldConvertLatex && options.htmlToMarkdown
    ? convertWebHtmlWithLatex(clipboardHtml, doc, options.htmlToMarkdown)
    : null;

  const beforePaste = new Map<string, string | undefined>();
  for (const node of view.canvas.nodes.values()) {
    const data = node.getData?.() as { id?: string; type?: string; text?: string } | undefined;
    if (data?.type === "text" && data.id) {
      beforePaste.set(data.id, data.text);
    }
  }

  window.requestAnimationFrame(() => {
    if (isInternalCopy || !(view.canvas.nodes instanceof Map)) {
      return;
    }

    for (const node of view.canvas.nodes.values()) {
      const data = node.getData?.() as { id?: string; type?: string; text?: string } | undefined;
      if (!data?.id) {
        continue;
      }
      const previousText = beforePaste.get(data.id);
      if (data.type !== "text" || previousText === data.text || typeof data.text !== "string") {
        continue;
      }

      let nextText = data.text;
      if (htmlMathResult?.hasMath) {
        nextText = previousText ? replaceInsertedTextDiff(previousText, data.text, htmlMathResult.markdown) : htmlMathResult.markdown;
      } else if (shouldConvertLatex) {
        nextText = convertLatexDelimiters(nextText);
      }

      if (shouldEscape) {
        nextText = clipboardHtml
          ? escapeObsidianSyntax(nextText, { preserveLatex: shouldConvertLatex })
          : escapeMarkdownSyntax(nextText, { preserveLatex: shouldConvertLatex });
      }

      if (nextText !== data.text) {
        node.setData?.({ text: nextText });
      }
    }
  });

  return true;
}
