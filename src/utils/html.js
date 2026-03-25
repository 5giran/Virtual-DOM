export const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const BLOCKED_SELECTORS = "script, iframe, object, embed";

export function sanitizeHtml(input) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");

  doc.querySelectorAll(BLOCKED_SELECTORS).forEach((node) => node.remove());

  for (const element of doc.body.querySelectorAll("*")) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  return doc.body.innerHTML.trim();
}

export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
