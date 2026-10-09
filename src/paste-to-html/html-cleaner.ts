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
  "form",
  "button",
  "input",
  "textarea",
  "select",
  "option",
];

const pageNoisePattern = /(?:^|[-_\s])(advert(?:isement)?|ads?|sponsor(?:ed)?|cookie|consent|share|social|related|recommend(?:ation)?|newsletter|subscribe|breadcrumb|toolbar|navbar|navigation|sidebar|popup|modal|tracking|analytics|promo(?:tion)?|widget|comments?|paywall|overlay)(?:$|[-_\s])/i;
const safeUrlPattern = /^(?:https?:|mailto:|tel:|\/|#|\.?\.?\/)/i;
const usefulAttributes = new Set([
  "alt",
  "cite",
  "colspan",
  "datetime",
  "dir",
  "headers",
  "height",
  "href",
  "lang",
  " rowspan",
  "rowspan",
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

  for (const element of Array.from(parsed.body.querySelectorAll("*"))) {
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
      if (usefulAttributes.has(name)) {
        if (urlAttributes.has(name) && !safeUrlPattern.test(attribute.value.trim())) {
          element.removeAttribute(attribute.name);
        }
        continue;
      }
      element.removeAttribute(attribute.name);
    }
  }

  return parsed.body.innerHTML.trim();
}