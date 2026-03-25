import { VOID_ELEMENTS } from "../../utils/html.js";

const BOOLEAN_ATTRIBUTES = new Set([
  "checked",
  "disabled",
  "hidden",
  "open",
  "readonly",
  "required",
  "selected",
]);

export function createDomFromVdom(vnode) {
  if (vnode.type === "fragment") {
    const fragment = document.createDocumentFragment();

    for (const child of vnode.children) {
      fragment.append(createDomFromVdom(child));
    }

    return fragment;
  }

  if (vnode.type === "text") {
    return document.createTextNode(vnode.value);
  }

  const element = document.createElement(vnode.tagName);

  syncAttributes(element, {}, vnode.attrs ?? {});

  if (!VOID_ELEMENTS.has(vnode.tagName)) {
    for (const child of vnode.children ?? []) {
      element.append(createDomFromVdom(child));
    }
  }

  return element;
}

export function renderVdom(container, vnode) {
  container.replaceChildren(createDomFromVdom(vnode));
}

export function syncAttributes(element, oldAttrs = {}, newAttrs = {}) {
  for (const name of Object.keys(oldAttrs)) {
    if (!(name in newAttrs)) {
      removeAttribute(element, name);
    }
  }

  for (const [name, value] of Object.entries(newAttrs)) {
    if (oldAttrs[name] !== value) {
      setAttribute(element, name, value);
    }
  }
}

function setAttribute(element, name, value) {
  if (name === "value") {
    element.value = value ?? "";
    element.setAttribute(name, value ?? "");
    return;
  }

  if (BOOLEAN_ATTRIBUTES.has(name)) {
    if (value === false || value == null) {
      element.removeAttribute(name);
      element[name] = false;
      return;
    }

    element.setAttribute(name, "");
    element[name] = true;
    return;
  }

  element.setAttribute(name, value);
}

function removeAttribute(element, name) {
  if (name === "value") {
    element.value = "";
  }

  if (BOOLEAN_ATTRIBUTES.has(name)) {
    element[name] = false;
  }

  element.removeAttribute(name);
}
