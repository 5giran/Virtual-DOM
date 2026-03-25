const IGNORED_ATTRIBUTES = new Set(["contenteditable", "spellcheck"]);
const WHITESPACE_SENSITIVE_TAGS = new Set(["pre", "textarea"]);

export function domToVdom(container) {
  return {
    type: "fragment",
    children: Array.from(container.childNodes)
      .map((child) => domNodeToVdom(child, container))
      .filter(Boolean),
  };
}

function domNodeToVdom(node, parentNode) {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.textContent ?? "";

    if (!shouldKeepTextNode(value, parentNode)) {
      return null;
    }

    return {
      type: "text",
      value,
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const tagName = node.tagName.toLowerCase();
  const attrs = collectAttributes(node);

  return {
    type: "element",
    tagName,
    attrs,
    children: Array.from(node.childNodes)
      .map((child) => domNodeToVdom(child, node))
      .filter(Boolean),
  };
}

function shouldKeepTextNode(value, parentNode) {
  if (!parentNode || parentNode.nodeType !== Node.ELEMENT_NODE) {
    return value.trim().length > 0;
  }

  const tagName = parentNode.tagName.toLowerCase();

  if (WHITESPACE_SENSITIVE_TAGS.has(tagName)) {
    return true;
  }

  return value.trim().length > 0;
}

function collectAttributes(element) {
  const attrs = {};

  for (const name of element.getAttributeNames()) {
    if (IGNORED_ATTRIBUTES.has(name)) {
      continue;
    }

    attrs[name] = element.getAttribute(name) ?? "";
  }

  if (element instanceof HTMLInputElement) {
    attrs.value = element.value;

    if (element.type === "checkbox" || element.type === "radio") {
      if (element.checked) {
        attrs.checked = "";
      } else {
        delete attrs.checked;
      }
    }
  }

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    attrs.value = element.value;
  }

  if (element instanceof HTMLOptionElement && element.selected) {
    attrs.selected = "";
  }

  if (element instanceof HTMLDetailsElement && element.open) {
    attrs.open = "";
  }

  return attrs;
}
