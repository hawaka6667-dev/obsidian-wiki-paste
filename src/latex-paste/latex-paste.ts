// @machine:
// Extracts web and AI-chat math formulas from clipboard HTML and converts \(...\) / \[...\] delimiters to Obsidian $/$$ syntax.
// Provides collision-free placeholder protection so Markdown syntax escaping never corrupts LaTeX formulas.

import { mathMlToLatex } from "./mathml-to-latex";

interface ExtractedMath {
  token: string;
  tex: string;
  display: boolean;
}

interface TextSegment {
  type: "code" | "text";
  value: string;
}

const MATH_SIGNAL_PATTERN = /\\[A-Za-z{}\\,;:!]|[\^_=+<>*/{}]/;

function isEscapedByBackslash(text: string, index: number): boolean {
  let slashes = 0;
  for (let pos = index - 1; pos >= 0 && text[pos] === "\\"; pos -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

function createTokenGenerator(source: string): (prefix: string) => string {
  let counter = 0;
  return (prefix: string) => {
    let token = `${prefix}${counter}END`;
    while (source.includes(token)) {
      counter += 1;
      token = `${prefix}${counter}END`;
    }
    counter += 1;
    return token;
  };
}

function splitCodeAndTextSegments(input: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let textStart = 0;
  let index = 0;

  while (index < input.length) {
    const atLineStart = index === 0 || input[index - 1] === "\n";
    if (atLineStart) {
      let lineEnd = input.indexOf("\n", index);
      if (lineEnd === -1) {
        lineEnd = input.length;
      }
      const line = input.slice(index, lineEnd).replace(/\r$/, "");
      const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (fenceMatch) {
        const fenceChar = fenceMatch[1][0];
        const fenceLen = fenceMatch[1].length;
        if (index > textStart) {
          segments.push({ type: "text", value: input.slice(textStart, index) });
        }

        let scan = lineEnd < input.length ? lineEnd + 1 : input.length;
        let blockEnd = input.length;
        while (scan < input.length) {
          let nextEnd = input.indexOf("\n", scan);
          if (nextEnd === -1) {
            nextEnd = input.length;
          }
          const candidate = input.slice(scan, nextEnd).replace(/\r$/, "");
          const closeMatch = new RegExp(`^ {0,3}${fenceChar}{${fenceLen},}\\s*$`);
          if (closeMatch.test(candidate)) {
            blockEnd = nextEnd < input.length ? nextEnd + 1 : input.length;
            break;
          }
          scan = nextEnd < input.length ? nextEnd + 1 : input.length;
        }
        segments.push({ type: "code", value: input.slice(index, blockEnd) });
        index = blockEnd;
        textStart = blockEnd;
        continue;
      }
    }

    if (input[index] === "`" && !isEscapedByBackslash(input, index)) {
      let tickEnd = index + 1;
      while (input[tickEnd] === "`") {
        tickEnd += 1;
      }
      const tickLen = tickEnd - index;
      const closingFence = "`".repeat(tickLen);
      let searchFrom = tickEnd;
      let closePos = -1;
      while (searchFrom < input.length) {
        const candidatePos = input.indexOf(closingFence, searchFrom);
        if (candidatePos === -1) {
          break;
        }
        const after = candidatePos + tickLen;
        if (input[candidatePos - 1] !== "`" && input[after] !== "`") {
          closePos = after;
          break;
        }
        searchFrom = candidatePos + 1;
      }
      if (closePos !== -1) {
        if (index > textStart) {
          segments.push({ type: "text", value: input.slice(textStart, index) });
        }
        segments.push({ type: "code", value: input.slice(index, closePos) });
        index = closePos;
        textStart = closePos;
        continue;
      }
      index = tickEnd;
      continue;
    }

    index += 1;
  }

  if (textStart < input.length) {
    segments.push({ type: "text", value: input.slice(textStart) });
  }
  return segments;
}

function findClosingInlineDollar(text: string, openingIndex: number): number {
  for (let index = openingIndex + 1; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === "\n" || ch === "\r") {
      return -1;
    }
    if (ch !== "$" || isEscapedByBackslash(text, index)) {
      continue;
    }
    if (text[index + 1] === "$") {
      continue;
    }
    const prev = text[index - 1];
    if (/\s/.test(prev)) {
      continue;
    }
    const body = text.slice(openingIndex + 1, index);
    if (!body.trim()) {
      continue;
    }
    const next = text[index + 1];
    if (next !== undefined && /\d/.test(next) && !/[\\^_{}]/.test(body)) {
      continue;
    }
    return index;
  }
  return -1;
}

function findClosingBlockDollar(text: string, openingIndex: number): number {
  for (let index = openingIndex + 2; index + 1 < text.length; index += 1) {
    if (text[index] === "$" && text[index + 1] === "$" && !isEscapedByBackslash(text, index)) {
      const body = text.slice(openingIndex + 2, index);
      if (body.trim()) {
        return index;
      }
    }
  }
  return -1;
}

function findClosingParenDelimiter(text: string, openingIndex: number): number {
  for (let index = openingIndex + 2; index + 1 < text.length; index += 1) {
    if (text[index] === "\n" && text[index + 1] === "\n") {
      return -1;
    }
    if (text[index] === "\r" && text[index + 1] === "\n" && text[index + 2] === "\r" && text[index + 3] === "\n") {
      return -1;
    }
    if (text[index] === "\\" && text[index + 1] === ")" && !isEscapedByBackslash(text, index)) {
      return index;
    }
  }
  return -1;
}

function findClosingBracketDelimiter(text: string, openingIndex: number): number {
  for (let index = openingIndex + 2; index + 1 < text.length; index += 1) {
    if (text[index] === "\\" && text[index + 1] === "]" && !isEscapedByBackslash(text, index)) {
      return index;
    }
  }
  return -1;
}

function isInsideMarkdownLinkLabel(text: string, start: number, end: number): boolean {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEndIdx = text.indexOf("\n", end);
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
  const beforeOnLine = text.slice(lineStart, start);
  const afterOnLine = text.slice(end, lineEnd);
  return beforeOnLine.includes("[") && /\]\(/.test(afterOnLine);
}

function isLikelyDisplayMathBracket(text: string, openIndex: number, closeIndex: number, body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) {
    return false;
  }
  if (isInsideMarkdownLinkLabel(text, openIndex, closeIndex + 2)) {
    return false;
  }
  if (trimmed.includes("\n")) {
    return true;
  }
  const lineStart = text.lastIndexOf("\n", openIndex - 1) + 1;
  const lineEndIdx = text.indexOf("\n", closeIndex + 2);
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
  const before = text.slice(lineStart, openIndex).trim();
  const after = text.slice(closeIndex + 2, lineEnd).trim();
  if (before === "" && after === "") {
    return true;
  }
  return MATH_SIGNAL_PATTERN.test(trimmed);
}

function convertDelimitersInTextSegment(text: string): string {
  let out = "";
  let index = 0;

  while (index < text.length) {
    if (text[index] === "$" && !isEscapedByBackslash(text, index)) {
      if (text[index + 1] === "$" && text[index + 2] !== "$") {
        const closeIndex = findClosingBlockDollar(text, index);
        if (closeIndex !== -1) {
          out += text.slice(index, closeIndex + 2);
          index = closeIndex + 2;
          continue;
        }
      } else if (text[index + 1] !== "$" && text[index + 1] !== undefined && !/\s/.test(text[index + 1])) {
        const closeIndex = findClosingInlineDollar(text, index);
        if (closeIndex !== -1) {
          out += text.slice(index, closeIndex + 1);
          index = closeIndex + 1;
          continue;
        }
      }
    }

    if (text[index] === "\\" && !isEscapedByBackslash(text, index)) {
      if (text[index + 1] === "(") {
        const closeIndex = findClosingParenDelimiter(text, index);
        if (closeIndex !== -1) {
          const rawBody = text.slice(index + 2, closeIndex);
          const normalized = normalizeExtractedTex(rawBody, false);
          if (normalized) {
            out += `$${normalized}$`;
            index = closeIndex + 2;
            continue;
          }
        }
      }

      if (text[index + 1] === "[") {
        const closeIndex = findClosingBracketDelimiter(text, index);
        if (closeIndex !== -1) {
          const rawBody = text.slice(index + 2, closeIndex);
          if (isLikelyDisplayMathBracket(text, index, closeIndex, rawBody)) {
            const normalized = normalizeExtractedTex(rawBody, true);
            if (normalized) {
              const isMultiline = rawBody.includes("\n") || normalized.includes("\n");
              out += isMultiline ? `$$\n${normalized}\n$$` : `$$${normalized}$$`;
              index = closeIndex + 2;
              continue;
            }
          }
        }
      }
    }

    out += text[index];
    index += 1;
  }

  return out;
}

export function convertLatexDelimiters(text: string): string {
  if (!text.includes("\\(") && !text.includes("\\[")) {
    return text;
  }

  return splitCodeAndTextSegments(text)
    .map((segment) => (segment.type === "code" ? segment.value : convertDelimitersInTextSegment(segment.value)))
    .join("");
}

export function protectLatexSpans(text: string): { text: string; restore: (input: string) => string } {
  const nextToken = createTokenGenerator(text);
  const replacements: Array<{ token: string; value: string }> = [];

  const protectedText = splitCodeAndTextSegments(text)
    .map((segment) => {
      if (segment.type === "code") {
        return segment.value;
      }

      const chunk = segment.value;
      let out = "";
      let index = 0;

      while (index < chunk.length) {
        if (chunk[index] === "$" && !isEscapedByBackslash(chunk, index)) {
          if (chunk[index + 1] === "$" && chunk[index + 2] !== "$") {
            const closeIndex = findClosingBlockDollar(chunk, index);
            if (closeIndex !== -1) {
              const token = nextToken("WIKIPASTELATEX");
              replacements.push({ token, value: chunk.slice(index, closeIndex + 2) });
              out += token;
              index = closeIndex + 2;
              continue;
            }
          } else if (chunk[index + 1] !== "$" && chunk[index + 1] !== undefined && !/\s/.test(chunk[index + 1])) {
            const closeIndex = findClosingInlineDollar(chunk, index);
            if (closeIndex !== -1) {
              const token = nextToken("WIKIPASTELATEX");
              replacements.push({ token, value: chunk.slice(index, closeIndex + 1) });
              out += token;
              index = closeIndex + 1;
              continue;
            }
          }
        }

        out += chunk[index];
        index += 1;
      }

      return out;
    })
    .join("");

  return {
    text: protectedText,
    restore(input: string): string {
      let restored = input;
      for (const entry of replacements) {
        restored = restored.split(entry.token).join(entry.value);
      }
      return restored;
    },
  };
}

function unwrapOuterBracedStyle(tex: string): string {
  const match = /^\{\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle)\s+([\s\S]*)\}$/.exec(tex);
  if (!match) {
    return tex;
  }

  let depth = 0;
  for (let index = 0; index < tex.length; index += 1) {
    const ch = tex[index];
    if (ch === "\\" && index + 1 < tex.length) {
      index += 1;
      continue;
    }
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return index === tex.length - 1 ? match[1].trim() : tex;
      }
    }
  }
  return tex;
}

function normalizeExtractedTex(raw: string, display: boolean): string {
  let tex = raw.replace(/\u00a0/g, " ").trim();
  if (!tex) {
    return "";
  }

  tex = unwrapOuterBracedStyle(tex);
  tex = tex.replace(/^\\(?:displaystyle|textstyle)\s+/, "").trim();

  if (tex.startsWith("$$") && tex.endsWith("$$") && tex.length >= 4) {
    tex = tex.slice(2, -2).trim();
  } else if (tex.startsWith("\\[") && tex.endsWith("\\]") && tex.length >= 4) {
    tex = tex.slice(2, -2).trim();
  } else if (tex.startsWith("\\(") && tex.endsWith("\\)") && tex.length >= 4) {
    tex = tex.slice(2, -2).trim();
  } else if (tex.startsWith("$") && tex.endsWith("$") && tex.length >= 2 && !tex.startsWith("$$")) {
    tex = tex.slice(1, -1).trim();
  }

  tex = unwrapOuterBracedStyle(tex);
  if (!display) {
    tex = tex.replace(/\r?\n\s*/g, " ").trim();
  }
  return tex;
}

function extractTexFromMathMlContainer(container: Element): string | null {
  const annotations = Array.from(container.querySelectorAll("annotation"));
  for (const annotation of annotations) {
    const encoding = (annotation.getAttribute("encoding") ?? "").toLowerCase();
    if ((!encoding || encoding.includes("tex") || encoding.includes("latex")) && annotation.textContent?.trim()) {
      return annotation.textContent;
    }
  }

  const mathEl = container.localName.toLowerCase() === "math"
    ? container
    : container.querySelector("math");
  if (mathEl) {
    const altText = mathEl.getAttribute("alttext");
    if (altText?.trim()) {
      return altText;
    }
    const converted = mathMlToLatex(mathEl);
    if (converted) {
      return converted;
    }
  }

  return null;
}

function isDisplayMathElement(element: Element): boolean {
  if (
    element.classList.contains("katex-display")
    || element.classList.contains("math-display")
    || element.classList.contains("math-block")
    || element.classList.contains("MathJax_Display")
    || element.classList.contains("mwe-math-mathml-display")
    || element.classList.contains("mwe-math-fallback-image-display")
    || element.classList.contains("js-display-math")
  ) {
    return true;
  }

  if (
    element.getAttribute("display") === "block"
    || element.getAttribute("display") === "true"
    || element.getAttribute("data-display") === "true"
    || element.getAttribute("eeimg") === "2"
    || element.getAttribute("data-eeimg") === "2"
  ) {
    return true;
  }

  if (element.localName.toLowerCase() === "script") {
    const type = (element.getAttribute("type") ?? "").toLowerCase();
    if (type.includes("mode=display")) {
      return true;
    }
  }

  if (element.closest(".katex-display, .math-display, .math-block, .MathJax_Display")) {
    return true;
  }

  const mathChild = element.querySelector("math");
  if (mathChild?.getAttribute("display") === "block") {
    return true;
  }

  return Boolean(element.querySelector(".mwe-math-mathml-display, .mwe-math-fallback-image-display"));
}

function isInsideCodeElement(element: Element): boolean {
  return Boolean(element.closest("pre, code, kbd, samp"));
}

function stripZhihuTrailingBreak(tex: string, element: Element): string {
  if (
    element.classList.contains("ztext-math")
    || element.hasAttribute("eeimg")
    || element.hasAttribute("data-eeimg")
  ) {
    return tex.replace(/\s*\\\\\s*$/, "").trim();
  }
  return tex;
}

function replaceMathElementWithPlaceholder(
  doc: Document,
  target: Element,
  tex: string,
  display: boolean,
  nextToken: (prefix: string) => string,
  extracted: ExtractedMath[],
): void {
  const cleanedTex = normalizeExtractedTex(stripZhihuTrailingBreak(tex, target), display);
  if (!cleanedTex) {
    return;
  }

  const token = nextToken("WIKIPASTEMATH");
  extracted.push({ token, tex: cleanedTex, display });

  if (display) {
    const block = doc.createElementNS("http://www.w3.org/1999/xhtml", "p");
    block.textContent = token;
    target.replaceWith(block);
  } else {
    target.replaceWith(doc.createTextNode(token));
  }
}

function extractMathNodesFromDom(doc: Document, root: Element): ExtractedMath[] {
  const nextToken = createTokenGenerator(root.innerHTML);
  const extracted: ExtractedMath[] = [];

  // 1. KaTeX display & inline containers
  for (const el of Array.from(root.querySelectorAll(".katex-display, .katex"))) {
    if (!el.isConnected || isInsideCodeElement(el)) {
      continue;
    }
    if (el.classList.contains("katex") && el.closest(".katex-display")) {
      continue;
    }
    const rawTex = extractTexFromMathMlContainer(el);
    if (rawTex) {
      replaceMathElementWithPlaceholder(doc, el, rawTex, isDisplayMathElement(el), nextToken, extracted);
    }
  }

  // 2. Wikipedia / MediaWiki .mwe-math-element
  for (const el of Array.from(root.querySelectorAll(".mwe-math-element"))) {
    if (!el.isConnected || isInsideCodeElement(el)) {
      continue;
    }
    const fallbackImg = el.querySelector("img.mwe-math-fallback-image-inline, img.mwe-math-fallback-image-display, img[alt]");
    const rawTex = extractTexFromMathMlContainer(el) ?? fallbackImg?.getAttribute("alt") ?? null;
    if (!rawTex) {
      continue;
    }

    const parentDd = el.parentElement?.localName.toLowerCase() === "dd" ? el.parentElement : null;
    const isSoleDdMath = Boolean(
      parentDd
      && Array.from(parentDd.childNodes).every(
        (node) => node === el || (node.nodeType === 3 && !(node.textContent ?? "").trim()),
      ),
    );
    const display = isDisplayMathElement(el) || isSoleDdMath;
    const targetToReplace = isSoleDdMath && parentDd ? parentDd : el;
    replaceMathElementWithPlaceholder(doc, targetToReplace, rawTex, display, nextToken, extracted);

    if (isSoleDdMath && parentDd?.parentElement?.localName.toLowerCase() === "dl") {
      const dl = parentDd.parentElement;
      const allParagraphs = Array.from(dl.children).every((child) => child.localName.toLowerCase() === "p");
      if (allParagraphs) {
        dl.replaceWith(...Array.from(dl.children));
      }
    }
  }

  // 3. MathJax v2 <script type="math/tex">
  for (const script of Array.from(root.querySelectorAll('script[type^="math/tex"]'))) {
    if (!script.isConnected || isInsideCodeElement(script)) {
      continue;
    }
    const rawTex = script.textContent ?? "";
    if (!rawTex.trim()) {
      continue;
    }
    const display = isDisplayMathElement(script);
    const displayWrapper = script.closest(".MathJax_Display, .MathJax_SVG_Display");
    if (displayWrapper) {
      replaceMathElementWithPlaceholder(doc, displayWrapper, rawTex, true, nextToken, extracted);
      continue;
    }
    const prev = script.previousElementSibling;
    if (prev && (prev.classList.contains("MathJax") || prev.classList.contains("MathJax_SVG"))) {
      const prevPreview = prev.previousElementSibling;
      if (prevPreview?.classList.contains("MathJax_Preview")) {
        prevPreview.remove();
      }
      prev.remove();
    }
    replaceMathElementWithPlaceholder(doc, script, rawTex, display, nextToken, extracted);
  }

  // 4. MathJax v3+ <mjx-container>
  for (const container of Array.from(root.querySelectorAll("mjx-container"))) {
    if (!container.isConnected || isInsideCodeElement(container)) {
      continue;
    }
    const rawTex = container.getAttribute("data-tex")
      ?? container.getAttribute("data-latex")
      ?? container.getAttribute("data-math")
      ?? extractTexFromMathMlContainer(container);
    if (rawTex) {
      replaceMathElementWithPlaceholder(doc, container, rawTex, isDisplayMathElement(container), nextToken, extracted);
    }
  }

  // 5. GitHub <math-renderer>
  for (const renderer of Array.from(root.querySelectorAll("math-renderer"))) {
    if (!renderer.isConnected || isInsideCodeElement(renderer)) {
      continue;
    }
    const rawTex = renderer.getAttribute("data-tex")
      ?? renderer.getAttribute("data-math")
      ?? extractTexFromMathMlContainer(renderer)
      ?? renderer.textContent;
    if (rawTex) {
      replaceMathElementWithPlaceholder(doc, renderer, rawTex, isDisplayMathElement(renderer), nextToken, extracted);
    }
  }

  // 6. Explicit data-* math attributes (Gemini, Zhihu, Notion, etc.)
  for (const el of Array.from(root.querySelectorAll("[data-tex], [data-latex], [data-math], [data-formula], [data-equation]"))) {
    if (!el.isConnected || isInsideCodeElement(el)) {
      continue;
    }
    const rawTex = el.getAttribute("data-tex")
      ?? el.getAttribute("data-latex")
      ?? el.getAttribute("data-math")
      ?? el.getAttribute("data-formula")
      ?? el.getAttribute("data-equation");
    if (rawTex?.trim()) {
      const hasEeimgBlock = el.getAttribute("eeimg") === "2" || el.getAttribute("data-eeimg") === "2";
      const hasTrailingZhihuBlock = (el.classList.contains("ztext-math") || el.hasAttribute("eeimg")) && /\\\\\s*$/.test(rawTex);
      replaceMathElementWithPlaceholder(
        doc,
        el,
        rawTex,
        isDisplayMathElement(el) || hasEeimgBlock || hasTrailingZhihuBlock,
        nextToken,
        extracted,
      );
    }
  }

  // 7. Standalone Wikipedia/Zhihu fallback math images
  for (const img of Array.from(root.querySelectorAll("img.mwe-math-fallback-image-inline, img.mwe-math-fallback-image-display, img.ztext-math"))) {
    if (!img.isConnected || isInsideCodeElement(img)) {
      continue;
    }
    const rawTex = img.getAttribute("alt");
    if (rawTex?.trim()) {
      replaceMathElementWithPlaceholder(doc, img, rawTex, isDisplayMathElement(img), nextToken, extracted);
    }
  }

  // 8. Any remaining standalone <math> (MathML)
  for (const mathEl of Array.from(root.querySelectorAll("math"))) {
    if (!mathEl.isConnected || isInsideCodeElement(mathEl)) {
      continue;
    }
    const rawTex = extractTexFromMathMlContainer(mathEl);
    if (rawTex) {
      replaceMathElementWithPlaceholder(doc, mathEl, rawTex, isDisplayMathElement(mathEl), nextToken, extracted);
    }
  }

  return extracted;
}

function restoreMathPlaceholders(markdown: string, extracted: ExtractedMath[]): string {
  let result = markdown;

  for (const item of extracted) {
    if (!item.display) {
      result = result.split(item.token).join(`$${item.tex}$`);
      continue;
    }

    const lines = result.split("\n");
    result = lines.map((line) => {
      if (!line.includes(item.token)) {
        return line;
      }
      const trimmed = line.trim();
      if (trimmed === item.token) {
        return `$$\n${item.tex}\n$$`;
      }
      const isBlockquoteLine = /^\s*>/.test(line);
      const replacement = isBlockquoteLine && !item.tex.includes("\n")
        ? `$$${item.tex}$$`
        : `\n$$\n${item.tex}\n$$\n`;
      return line.split(item.token).join(replacement);
    }).join("\n");
  }

  return result;
}

export function convertWebHtmlWithLatex(
  html: string,
  doc: Document,
  htmlToMarkdown: (element: HTMLElement) => string,
): { markdown: string; hasMath: boolean } {
  const Parser = doc.defaultView?.DOMParser ?? window.DOMParser;
  if (!Parser || !html) {
    return { markdown: "", hasMath: false };
  }

  const parsed = new Parser().parseFromString(html, "text/html");
  const extracted = extractMathNodesFromDom(parsed, parsed.body);
  if (extracted.length === 0) {
    return { markdown: "", hasMath: false };
  }

  const rawMarkdown = htmlToMarkdown(parsed.body);
  const convertedDelimiters = convertLatexDelimiters(rawMarkdown);
  const restored = restoreMathPlaceholders(convertedDelimiters, extracted);
  return { markdown: restored, hasMath: true };
}
