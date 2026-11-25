import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  convertLatexDelimiters,
  convertWebHtmlWithLatex,
  protectLatexSpans,
} from "../src/latex-paste/latex-paste.ts";
import { escapeMarkdownSyntax, escapeObsidianSyntax } from "../src/escape-markdown-syntax/md-syntax-escaping.ts";
import {
  clearRecentInternalMarkdownCopy,
  handleEditorCopy,
  handleEditorPaste,
} from "../src/escape-markdown-syntax/md-editor-paste-handler.ts";

function createEvent(target, values = {}) {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    target,
    clipboardData: { getData: (type) => values[type] ?? "" },
    preventDefault() {
      defaultPrevented = true;
    },
    stopPropagation() {
      propagationStopped = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
    get propagationStopped() {
      return propagationStopped;
    },
  };
}

test("converts AI chat \\(...\\) and \\[...\\] delimiters while skipping code and bracket false positives", () => {
  const input = [
    "Inline \\( E = mc^2 \\) and multiline:",
    "\\[",
    "  \\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}",
    "\\]",
    "Keep code `\\(a + b\\)` and fenced:",
    "```tex",
    "\\[ x^2 \\]",
    "```",
    "Keep regex [\\[41\\]](https://example.com) and escaped \\\\(not math\\\\).",
  ].join("\n");

  const expected = [
    "Inline $E = mc^2$ and multiline:",
    "$$",
    "\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}",
    "$$",
    "Keep code `\\(a + b\\)` and fenced:",
    "```tex",
    "\\[ x^2 \\]",
    "```",
    "Keep regex [\\[41\\]](https://example.com) and escaped \\\\(not math\\\\).",
  ].join("\n");

  assert.equal(convertLatexDelimiters(input), expected);
});

test("preserves LaTeX formulas when escaping Markdown and Obsidian syntax with preserveLatex", () => {
  const input = "Formula $x_1^2 + y_2^2 = |z|$ and [^ref] #tag ~~strike~~.";
  assert.equal(
    escapeMarkdownSyntax(input, { preserveLatex: true }),
    String.raw`Formula $x_1^2 + y_2^2 = |z|$ and \[^ref] \#tag \~~strike\~~.`,
  );
  assert.equal(
    escapeObsidianSyntax("Block:\n$$\na_1 &= b_2 \\\\\nc &= d\n$$\nRef [^1].", { preserveLatex: true }),
    "Block:\n$$\na_1 &= b_2 \\\\\nc &= d\n$$\nRef \\[^1].",
  );
});

test("does not treat currency spans like $5-$10 as LaTeX", () => {
  const protectedCurrency = protectLatexSpans("Price $5-$10 or $5 and $10.");
  assert.equal(protectedCurrency.text, "Price $5-$10 or $5 and $10.");
});

test("extracts KaTeX, Wikipedia, MathJax v2/v3, and Zhihu web math HTML", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const doc = dom.window.document;
  const mockHtmlToMarkdown = (el) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

  // KaTeX inline + display
  const katexHtml = `
    <p>Energy <span class="katex"><span class="katex-mathml"><math><semantics><mrow></mrow><annotation encoding="application/x-tex">E = mc^2</annotation></semantics></math></span><span class="katex-html">Emc2</span></span>.</p>
    <span class="katex-display"><span class="katex"><span class="katex-mathml"><math><semantics><mrow></mrow><annotation encoding="application/x-tex">\\frac{a}{b}</annotation></semantics></math></span><span class="katex-html">a/b</span></span></span>
  `;
  const katexResult = convertWebHtmlWithLatex(katexHtml, doc, (el) =>
    Array.from(el.children).map((child) => child.textContent?.trim()).filter(Boolean).join("\n\n"),
  );
  assert.equal(katexResult.hasMath, true);
  assert.equal(katexResult.markdown, "Energy $E = mc^2$.\n\n$$\n\\frac{a}{b}\n$$");

  // Wikipedia <dl><dd><span class="mwe-math-element"> with {\displaystyle ...}
  const wikiHtml = `<dl><dd><span class="mwe-math-element"><math alttext="{\\displaystyle \\sum_{i=1}^n i}"><semantics><mrow></mrow><annotation encoding="application/x-tex">{\\displaystyle \\sum_{i=1}^n i}</annotation></semantics></math><img class="mwe-math-fallback-image-inline" alt="{\\displaystyle \\sum_{i=1}^n i}"></span></dd></dl>`;
  const wikiResult = convertWebHtmlWithLatex(wikiHtml, doc, mockHtmlToMarkdown);
  assert.equal(wikiResult.hasMath, true);
  assert.equal(wikiResult.markdown, "$$\n\\sum_{i=1}^n i\n$$");

  // MathJax v3 pure MathML without annotation
  const mjx3Html = `<p>Root: <mjx-container class="MathJax"><mjx-assistive-mml><math><msqrt><mfrac><mi>x</mi><mi>y</mi></mfrac></msqrt><mo>+</mo><msup><mi>z</mi><mn>2</mn></msup></math></mjx-assistive-mml></mjx-container></p>`;
  const mjx3Result = convertWebHtmlWithLatex(mjx3Html, doc, mockHtmlToMarkdown);
  assert.equal(mjx3Result.hasMath, true);
  assert.equal(mjx3Result.markdown, "Root: $\\sqrt{\\frac{x}{y}} + z^2$");

  // MathJax v2 script + Zhihu data-tex
  const mjx2AndZhihu = `<span class="MathJax_Preview"></span><span class="MathJax">x</span><script type="math/tex">\\alpha + \\beta</script> and <img class="ztext-math" eeimg="2" data-tex="a^2 + b^2 = c^2 \\\\">`;
  const mjx2Result = convertWebHtmlWithLatex(mjx2AndZhihu, doc, mockHtmlToMarkdown);
  assert.equal(mjx2Result.hasMath, true);
  assert.equal(mjx2Result.markdown, "$\\alpha + \\beta$ and \n$$\na^2 + b^2 = c^2\n$$\n");

  // Ignore inside <pre><code>
  const codeHtml = `<pre><code><span data-tex="x^2">x^2</span></code></pre>`;
  const codeResult = convertWebHtmlWithLatex(codeHtml, doc, mockHtmlToMarkdown);
  assert.equal(codeResult.hasMath, false);

  dom.window.close();
});

test("handleEditorPaste converts external LaTeX even when escapeMarkdownSyntax is false and skips internal copies", () => {
  const dom = new JSDOM("<div class='view'><div class='cm-content'></div></div>");
  const containerEl = dom.window.document.querySelector(".view");
  const editorContent = containerEl.querySelector(".cm-content");
  const replacements = [];
  const editor = {
    getSelection: () => "\\(a_1\\)",
    replaceSelection: (text) => replacements.push(text),
    getValue: () => "",
  };
  const view = { containerEl, editor };

  // Internal copy is preserved
  assert.equal(handleEditorCopy(createEvent(editorContent), view), true);
  const internalPaste = createEvent(editorContent, { "text/plain": "\\(a_1\\)" });
  assert.equal(
    handleEditorPaste(internalPaste, view, { escapeMarkdownSyntax: false, convertLatexOnPaste: true }),
    false,
  );
  assert.deepEqual(replacements, []);

  // External plain-text AI chat paste
  const externalPlain = createEvent(editorContent, { "text/plain": "Compute \\( x_1^2 \\) here." });
  assert.equal(
    handleEditorPaste(externalPlain, view, { escapeMarkdownSyntax: false, convertLatexOnPaste: true }),
    true,
  );
  assert.deepEqual(replacements, ["Compute $x_1^2$ here."]);

  // External HTML KaTeX paste with escaping enabled
  const externalHtml = createEvent(editorContent, {
    "text/plain": "x^2",
    "text/html": '<p>See [^1] and <span class="katex"><annotation encoding="application/x-tex">x_1^2</annotation></span></p>',
  });
  assert.equal(
    handleEditorPaste(externalHtml, view, {
      escapeMarkdownSyntax: true,
      convertLatexOnPaste: true,
      htmlToMarkdown: (el) => el.textContent ?? "",
    }),
    true,
  );
  assert.equal(replacements[1], String.raw`See \[^1] and $x_1^2$`);

  clearRecentInternalMarkdownCopy(dom.window.document);
  dom.window.close();
});
