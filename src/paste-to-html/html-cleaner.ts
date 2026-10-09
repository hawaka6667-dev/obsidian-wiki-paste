// @machine:
// Sanitizes copied webpage HTML while preserving content structure and useful attributes.
// Removes executable, presentational, tracking, and page-chrome noise before editor insertion.

const removedElements = [
  "script",
  "style",
  "meta",
  "link",
  "base",
  "title",
  "noscript",
  "template",
  "iframe",
  "object",
  "embed",
  "input",
  "textarea",
  "select",
  "option",
];

const pageNoisePattern = /(?:^|[-_\s])(advert(?:isement)?|ads?|sponsor(?:ed)?|cookie|consent|tracking|analytics|paywall)(?:$|[-_\s])/i;
const defaultInfoPattern = /^(?:no information (?:is )?available for this page\.?|there is no information for this page\.?|没有此网页的信息。?|此网页没有可用信息。?|了解原因|learn why)$/i;
const unsafeUrlSchemePattern = /^[a-z][a-z\d+.-]*:/i;
const usefulAttributes = new Set([
  "alt",
  "cite",
  "colspan",
  "datetime",
  "dir",
  "headers",
  "height",
  "href",
  "id",
  "lang",
  "rowspan",
  "role",
  "scope",
  "src",
  "srcset",
  "start",
  "target",
  "title",
  "width",
]);
const urlAttributes = new Set(["href", "src", "cite"]);

export function cleanHtml(html: string, document: Document): string {
  const Parser = document.defaultView?.DOMParser;
  if (!Parser) {
    return "";
  }

  const parsed = new Parser().parseFromString(html, "text/html");
  for (const element of Array.from(parsed.body.querySelectorAll(removedElements.join(",")))) {
    element.remove();
  }

  const nodeFilter = document.defaultView?.NodeFilter;
  if (nodeFilter) {
    const commentWalker = parsed.createTreeWalker(parsed.body, nodeFilter.SHOW_COMMENT);
    let comment = commentWalker.nextNode();
    while (comment) {
      const nextComment = commentWalker.nextNode();
      comment.parentNode?.removeChild(comment);
      comment = nextComment;
    }
  }

  for (const element of Array.from(parsed.body.querySelectorAll("*"))) {
    const style = element.getAttribute("style") ?? "";
    if (
      element.hasAttribute("hidden")
      || element.hasAttribute("inert")
      || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|content-visibility\s*:\s*hidden)\b/i.test(style)
    ) {
      element.remove();
      continue;
    }

    const textWalker = parsed.createTreeWalker(element, document.defaultView?.NodeFilter.SHOW_TEXT ?? 4);
    let textNode = textWalker.nextNode();
    while (textNode) {
      const nextTextNode = textWalker.nextNode();
      if (defaultInfoPattern.test(textNode.textContent?.trim() ?? "")) {
        textNode.parentNode?.removeChild(textNode);
      }
      textNode = nextTextNode;
    }

    const sourceLabel = `${element.id} ${element.getAttribute("class") ?? ""}`;
    if (pageNoisePattern.test(sourceLabel)) {
      element.remove();
      continue;
    }

    const lazyImageSource = element.localName === "img"
      ? element.getAttribute("data-src") ?? element.getAttribute("data-lazy-src")
      : null;
    if (lazyImageSource && !element.hasAttribute("src")) {
      element.setAttribute("src", lazyImageSource);
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("aria-") || usefulAttributes.has(name)) {
        if (urlAttributes.has(name) && !isSafeUrl(attribute.value, element, name)) {
          element.removeAttribute(attribute.name);
        } else if (name === "srcset" && !isSafeSrcSet(attribute.value)) {
          element.removeAttribute(attribute.name);
        }
        continue;
      }
      element.removeAttribute(attribute.name);
    }
  }

  return parsed.body.innerHTML.trim();
}

function isSafeUrl(value: string, element: Element, attributeName: string): boolean {
  const trimmedValue = value.trim();
  if (/^(?:https?:|mailto:|tel:)/i.test(trimmedValue)) {
    return true;
  }

  if (
    element.localName === "img"
    && attributeName === "src"
    && /^data:image\/(?:gif|jpeg|png|webp|svg\+xml);base64,/i.test(trimmedValue)
  ) {
    return true;
  }

  return !unsafeUrlSchemePattern.test(trimmedValue);
}

function isSafeSrcSet(value: string): boolean {
  const unsafeScheme = /(?:^|[\s,])(?!(?:https?|data):)[a-z][a-z\d+.-]*:/i;
  const unsafeDataUrl = /(?:^|[\s,])data:(?!image\/(?:gif|jpeg|png|webp|svg\+xml);base64,)/i;
  return !unsafeScheme.test(value) && !unsafeDataUrl.test(value);
}