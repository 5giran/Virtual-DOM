import { escapeAttribute, escapeHtml, VOID_ELEMENTS } from "../../utils/html.js";

export function serializeVdom(vnode) {
  return stringifyNode(vnode, 0).trim();
}

function stringifyNode(vnode, depth) {
  if (!vnode) {
    return "";
  }

  if (vnode.type === "fragment") {
    return vnode.children.map((child) => stringifyNode(child, depth)).join("\n");
  }

  if (vnode.type === "text") {
    return `${indent(depth)}${escapeHtml(vnode.value)}`;
  }

  const attrs = Object.entries(vnode.attrs ?? {})
    .map(([name, value]) =>
      value === "" ? name : `${name}="${escapeAttribute(String(value))}"`,
    )
    .join(" ");

  const openingTag = attrs ? `<${vnode.tagName} ${attrs}>` : `<${vnode.tagName}>`;

  if (VOID_ELEMENTS.has(vnode.tagName)) {
    return `${indent(depth)}${openingTag}`;
  }

  if (!vnode.children || vnode.children.length === 0) {
    return `${indent(depth)}${openingTag}</${vnode.tagName}>`;
  }

  if (hasOnlyTextChildren(vnode)) {
    const textContent = vnode.children
      .map((child) => (child.type === "text" ? escapeHtml(child.value) : stringifyNode(child, 0)))
      .join("");

    return `${indent(depth)}${openingTag}${textContent}</${vnode.tagName}>`;
  }

  const children = vnode.children
    .map((child) => stringifyNode(child, depth + 1))
    .join("\n");

  return `${indent(depth)}${openingTag}\n${children}\n${indent(depth)}</${vnode.tagName}>`;
}

function hasOnlyTextChildren(vnode) {
  return vnode.children.every((child) => child.type === "text");
}

function indent(depth) {
  return "  ".repeat(depth);
}
