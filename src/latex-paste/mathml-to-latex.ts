// @machine:
// Converts MathML <math> DOM trees without TeX annotations into Obsidian-compatible LaTeX strings.
// Handles operators, fractions, scripts, roots, accents, matrices, and common Unicode math symbols.

const UNICODE_TO_LATEX: Record<string, string> = {
  "\u00b1": "\\pm",
  "\u2213": "\\mp",
  "\u00d7": "\\times",
  "\u00f7": "\\div",
  "\u00b7": "\\cdot",
  "\u22c5": "\\cdot",
  "\u2217": "*",
  "\u2218": "\\circ",
  "\u221e": "\\infty",
  "\u2202": "\\partial",
  "\u2207": "\\nabla",
  "\u2200": "\\forall",
  "\u2203": "\\exists",
  "\u2204": "\\nexists",
  "\u2205": "\\emptyset",
  "\u2208": "\\in",
  "\u2209": "\\notin",
  "\u220b": "\\ni",
  "\u2282": "\\subset",
  "\u2283": "\\supset",
  "\u2286": "\\subseteq",
  "\u2287": "\\supseteq",
  "\u222a": "\\cup",
  "\u2229": "\\cap",
  "\u2227": "\\land",
  "\u2228": "\\lor",
  "\u00ac": "\\neg",
  "\u2260": "\\neq",
  "\u2264": "\\le",
  "\u2265": "\\ge",
  "\u226a": "\\ll",
  "\u226b": "\\gg",
  "\u2248": "\\approx",
  "\u2261": "\\equiv",
  "\u2245": "\\cong",
  "\u223c": "\\sim",
  "\u2243": "\\simeq",
  "\u221d": "\\propto",
  "\u22a5": "\\perp",
  "\u2225": "\\parallel",
  "\u2220": "\\angle",
  "\u2211": "\\sum",
  "\u220f": "\\prod",
  "\u2210": "\\coprod",
  "\u222b": "\\int",
  "\u222c": "\\iint",
  "\u222d": "\\iiint",
  "\u222e": "\\oint",
  "\u2190": "\\leftarrow",
  "\u2192": "\\to",
  "\u2194": "\\leftrightarrow",
  "\u21d0": "\\Leftarrow",
  "\u21d2": "\\Rightarrow",
  "\u21d4": "\\Leftrightarrow",
  "\u21a6": "\\mapsto",
  "\u2026": "\\dots",
  "\u22ef": "\\cdots",
  "\u22ee": "\\vdots",
  "\u22f1": "\\ddots",
  "\u2212": "-",
  "\u2032": "'",
  "\u2033": "''",
  "\u03b1": "\\alpha",
  "\u03b2": "\\beta",
  "\u03b3": "\\gamma",
  "\u03b4": "\\delta",
  "\u03b5": "\\varepsilon",
  "\u03f5": "\\epsilon",
  "\u03b6": "\\zeta",
  "\u03b7": "\\eta",
  "\u03b8": "\\theta",
  "\u03d1": "\\vartheta",
  "\u03b9": "\\iota",
  "\u03ba": "\\kappa",
  "\u03bb": "\\lambda",
  "\u03bc": "\\mu",
  "\u03bd": "\\nu",
  "\u03be": "\\xi",
  "\u03c0": "\\pi",
  "\u03d6": "\\varpi",
  "\u03c1": "\\rho",
  "\u03f1": "\\varrho",
  "\u03c3": "\\sigma",
  "\u03c2": "\\varsigma",
  "\u03c4": "\\tau",
  "\u03c5": "\\upsilon",
  "\u03c6": "\\varphi",
  "\u03d5": "\\phi",
  "\u03c7": "\\chi",
  "\u03c8": "\\psi",
  "\u03c9": "\\omega",
  "\u0393": "\\Gamma",
  "\u0394": "\\Delta",
  "\u0398": "\\Theta",
  "\u039b": "\\Lambda",
  "\u039e": "\\Xi",
  "\u03a0": "\\Pi",
  "\u03a3": "\\Sigma",
  "\u03a5": "\\Upsilon",
  "\u03a6": "\\Phi",
  "\u03a8": "\\Psi",
  "\u03a9": "\\Omega",
  "\u211d": "\\mathbb{R}",
  "\u2102": "\\mathbb{C}",
  "\u2115": "\\mathbb{N}",
  "\u2124": "\\mathbb{Z}",
  "\u211a": "\\mathbb{Q}",
  "\u210f": "\\hbar",
  "\u2113": "\\ell",
  "\u211c": "\\Re",
  "\u2111": "\\Im",
  "\u2135": "\\aleph",
};

const KNOWN_OPERATORS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc",
  "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "coth",
  "log", "ln", "lg", "exp", "lim", "limsup", "liminf",
  "max", "min", "sup", "inf", "arg", "det", "dim", "gcd", "hom", "ker", "Pr", "deg",
]);

const ACCENT_MAP: Record<string, string> = {
  "\u00af": "\\overline",
  "\u203e": "\\overline",
  "_": "\\underline",
  "^": "\\hat",
  "\u02c6": "\\hat",
  "~": "\\tilde",
  "\u02dc": "\\tilde",
  "\u2192": "\\vec",
  "\u20d7": "\\vec",
  "\u02d9": "\\dot",
  ".": "\\dot",
  "\u00a8": "\\ddot",
  "..": "\\ddot",
};

const LIMIT_OPS = new Set([
  "\\sum", "\\prod", "\\coprod", "\\int", "\\iint", "\\iiint", "\\oint",
  "\\lim", "\\limsup", "\\liminf", "\\max", "\\min", "\\sup", "\\inf",
]);

function mapCharacters(text: string): string {
  let result = "";
  for (const ch of text) {
    result += UNICODE_TO_LATEX[ch] ?? ch;
  }
  return result;
}

function wrapBraces(tex: string): string {
  const trimmed = tex.trim();
  if (trimmed.length <= 1 && !trimmed.startsWith("\\")) {
    return trimmed;
  }
  return `{${trimmed}}`;
}

function escapeLatexText(text: string): string {
  return text.replace(/([\\{}$&#_%])/g, "\\$1");
}

function isWhitespaceText(text: string): boolean {
  return /^[\s\u00a0\u200b-\u200d\ufeff]*$/.test(text);
}

function elementChildren(el: Element): Element[] {
  return Array.from(el.children);
}

function convertChildren(el: Element): string {
  const parts: string[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      const val = (child.textContent ?? "").replace(/\u00a0/g, " ");
      if (!isWhitespaceText(val)) {
        parts.push(mapCharacters(val.trim()));
      }
      continue;
    }
    if (child.nodeType === 1) {
      const converted = convertNode(child as Element);
      if (converted) {
        parts.push(converted);
      }
    }
  }
  return joinParts(parts);
}

function joinParts(parts: string[]): string {
  let out = "";
  for (const part of parts) {
    if (!part) {
      continue;
    }
    if (out) {
      const last = out[out.length - 1];
      const first = part[0];
      const needsSpace =
        (/[A-Za-z]/.test(last) && /[A-Za-z0-9]/.test(first) && /\\[A-Za-z]+$/.test(out))
        || (/[=+\-*/<>|,]/.test(last) && !/^[,.)\]}\s]/.test(part))
        || (!/^[.,;:!?)\]}/_^']/.test(part) && /[=<>+-]/.test(first));
      if (needsSpace && !out.endsWith(" ")) {
        out += " ";
      }
    }
    out += part;
  }
  return out;
}

function convertToken(el: Element, tag: string): string {
  const raw = (el.textContent ?? "").replace(/[\u00a0\u200b-\u200d\ufeff]/g, " ").trim();
  if (!raw) {
    return "";
  }

  if (tag === "mtext" || tag === "ms") {
    return `\\text{${escapeLatexText(raw)}}`;
  }

  if (tag === "mi") {
    if (KNOWN_OPERATORS.has(raw)) {
      return `\\${raw}`;
    }
    if (raw.length > 1 && !UNICODE_TO_LATEX[raw]) {
      const mapped = mapCharacters(raw);
      if (mapped !== raw) {
        return mapped;
      }
      const variant = el.getAttribute("mathvariant");
      if (variant === "normal" || /^[A-Za-z]+$/.test(raw)) {
        return `\\mathrm{${raw}}`;
      }
    }
    return mapCharacters(raw);
  }

  if (tag === "mo") {
    if (raw === "{" || raw === "}") {
      return `\\${raw}`;
    }
    if (raw === "\u2061" || raw === "\u2062" || raw === "\u2063") {
      return "";
    }
    return mapCharacters(raw);
  }

  return mapCharacters(raw);
}

function convertNode(el: Element): string {
  const tag = el.localName.toLowerCase();
  const children = elementChildren(el);

  switch (tag) {
    case "annotation":
    case "annotation-xml":
      return "";
    case "math":
    case "mrow":
    case "mstyle":
    case "mpadded":
    case "mphantom":
    case "math-wrapper":
      return convertChildren(el);
    case "semantics": {
      const texAnnotation = children.find((child) => {
        if (child.localName.toLowerCase() !== "annotation") {
          return false;
        }
        const encoding = (child.getAttribute("encoding") ?? "").toLowerCase();
        return encoding.includes("tex") || encoding.includes("latex");
      });
      if (texAnnotation?.textContent?.trim()) {
        return texAnnotation.textContent.trim();
      }
      const firstBody = children.find((child) => {
        const childTag = child.localName.toLowerCase();
        return childTag !== "annotation" && childTag !== "annotation-xml";
      });
      return firstBody ? convertNode(firstBody) : convertChildren(el);
    }
    case "mi":
    case "mn":
    case "mo":
    case "mtext":
    case "ms":
      return convertToken(el, tag);
    case "mspace":
      return " ";
    case "mfrac": {
      const num = children[0] ? convertNode(children[0]) : "";
      const den = children[1] ? convertNode(children[1]) : "";
      if (el.getAttribute("linethickness") === "0") {
        return `\\binom{${num}}{${den}}`;
      }
      return `\\frac{${num}}{${den}}`;
    }
    case "msqrt":
      return `\\sqrt{${convertChildren(el)}}`;
    case "mroot": {
      const base = children[0] ? convertNode(children[0]) : "";
      const index = children[1] ? convertNode(children[1]) : "";
      return index ? `\\sqrt[${index}]{${base}}` : `\\sqrt{${base}}`;
    }
    case "msup": {
      const base = children[0] ? convertNode(children[0]) : "";
      const sup = children[1] ? convertNode(children[1]) : "";
      return `${base}^${wrapBraces(sup)}`;
    }
    case "msub": {
      const base = children[0] ? convertNode(children[0]) : "";
      const sub = children[1] ? convertNode(children[1]) : "";
      return `${base}_${wrapBraces(sub)}`;
    }
    case "msubsup": {
      const base = children[0] ? convertNode(children[0]) : "";
      const sub = children[1] ? convertNode(children[1]) : "";
      const sup = children[2] ? convertNode(children[2]) : "";
      return `${base}_${wrapBraces(sub)}^${wrapBraces(sup)}`;
    }
    case "mover": {
      const base = children[0] ? convertNode(children[0]) : "";
      const rawOver = (children[1]?.textContent ?? "").trim();
      const accentCmd = ACCENT_MAP[rawOver];
      if (accentCmd) {
        return `${accentCmd}{${base}}`;
      }
      const over = children[1] ? convertNode(children[1]) : "";
      if (LIMIT_OPS.has(base)) {
        return `${base}^${wrapBraces(over)}`;
      }
      return `\\overset{${over}}{${base}}`;
    }
    case "munder": {
      const base = children[0] ? convertNode(children[0]) : "";
      const rawUnder = (children[1]?.textContent ?? "").trim();
      if (rawUnder === "_" || rawUnder === "\u0332") {
        return `\\underline{${base}}`;
      }
      const under = children[1] ? convertNode(children[1]) : "";
      if (LIMIT_OPS.has(base)) {
        return `${base}_${wrapBraces(under)}`;
      }
      return `\\underset{${under}}{${base}}`;
    }
    case "munderover": {
      const base = children[0] ? convertNode(children[0]) : "";
      const under = children[1] ? convertNode(children[1]) : "";
      const over = children[2] ? convertNode(children[2]) : "";
      if (LIMIT_OPS.has(base)) {
        return `${base}_${wrapBraces(under)}^${wrapBraces(over)}`;
      }
      return `\\underset{${under}}{\\overset{${over}}{${base}}}`;
    }
    case "mfenced": {
      const open = el.getAttribute("open") ?? "(";
      const close = el.getAttribute("close") ?? ")";
      const sep = el.getAttribute("separators") ?? ",";
      const items = children.map((child) => convertNode(child)).filter(Boolean);
      const sepChar = sep.length > 0 ? `${sep[0]} ` : "";
      const openDelim = open === "{" ? "\\{" : open || ".";
      const closeDelim = close === "}" ? "\\}" : close || ".";
      return `\\left${openDelim} ${items.join(sepChar)}\\right${closeDelim}`;
    }
    case "mtable": {
      const rows = children
        .filter((child) => child.localName.toLowerCase() === "mtr" || child.localName.toLowerCase() === "mlabeledtr")
        .map((row) => {
          const cells = elementChildren(row)
            .filter((cell) => cell.localName.toLowerCase() === "mtd")
            .map((cell) => convertChildren(cell));
          return cells.join(" & ");
        });
      return `\\begin{matrix} ${rows.join(" \\\\ ")} \\end{matrix}`;
    }
    case "menclose": {
      const notation = el.getAttribute("notation") ?? "";
      const inner = convertChildren(el);
      if (notation.includes("box")) {
        return `\\boxed{${inner}}`;
      }
      return inner;
    }
    default:
      return convertChildren(el);
  }
}

export function mathMlToLatex(mathElement: Element): string {
  return convertNode(mathElement).replace(/\s{2,}/g, " ").trim();
}
