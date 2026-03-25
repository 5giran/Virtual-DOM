import { createDomFromVdom, syncAttributes } from "../vdom/createDomFromVdom.js";
import { getNodeKey } from "../../utils/nodeKey.js";

export function patchDom(container, oldVdom, newVdom) {
  reconcileChildren(container, oldVdom.children ?? [], newVdom.children ?? []);
}

function reconcileNode(parentDom, domNode, oldVNode, newVNode) {
  if (!oldVNode && newVNode) {
    const created = createDomFromVdom(newVNode);
    parentDom.append(created);
    return created;
  }

  if (oldVNode && !newVNode) {
    domNode?.remove();
    return null;
  }

  if (!domNode) {
    const created = createDomFromVdom(newVNode);
    parentDom.append(created);
    return created;
  }

  if (oldVNode.type !== newVNode.type) {
    const replacement = createDomFromVdom(newVNode);
    parentDom.replaceChild(replacement, domNode);
    return replacement;
  }

  if (newVNode.type === "text") {
    if (domNode.nodeType !== Node.TEXT_NODE) {
      const replacement = createDomFromVdom(newVNode);
      parentDom.replaceChild(replacement, domNode);
      return replacement;
    }

    if (domNode.textContent !== newVNode.value) {
      domNode.textContent = newVNode.value;
    }

    return domNode;
  }

  if (oldVNode.tagName !== newVNode.tagName) {
    const replacement = createDomFromVdom(newVNode);
    parentDom.replaceChild(replacement, domNode);
    return replacement;
  }

  syncAttributes(domNode, oldVNode.attrs ?? {}, newVNode.attrs ?? {});
  reconcileChildren(domNode, oldVNode.children ?? [], newVNode.children ?? []);
  return domNode;
}

function reconcileChildren(parentDom, oldChildren, newChildren) {
  const domChildren = Array.from(parentDom.childNodes);
  const keyedOldChildren = new Map();
  const unkeyedOldChildren = [];

  oldChildren.forEach((child, index) => {
    const entry = {
      child,
      domNode: domChildren[index],
    };
    const key = getNodeKey(child);

    if (key) {
      keyedOldChildren.set(key, entry);
      return;
    }

    unkeyedOldChildren.push(entry);
  });

  const usedNodes = new Set();
  let unkeyedCursor = 0;

  newChildren.forEach((newChild, newIndex) => {
    const key = getNodeKey(newChild);
    const referenceNode = parentDom.childNodes[newIndex] ?? null;

    if (key && keyedOldChildren.has(key)) {
      const entry = keyedOldChildren.get(key);
      const updatedNode = reconcileNode(parentDom, entry.domNode, entry.child, newChild);

      if (updatedNode && updatedNode !== parentDom.childNodes[newIndex]) {
        parentDom.insertBefore(updatedNode, referenceNode);
      }

      if (updatedNode) {
        usedNodes.add(updatedNode);
      }

      return;
    }

    const oldEntry = unkeyedOldChildren[unkeyedCursor] ?? null;

    if (oldEntry) {
      unkeyedCursor += 1;
      const updatedNode = reconcileNode(parentDom, oldEntry.domNode, oldEntry.child, newChild);

      if (updatedNode && updatedNode !== parentDom.childNodes[newIndex]) {
        parentDom.insertBefore(updatedNode, referenceNode);
      }

      if (updatedNode) {
        usedNodes.add(updatedNode);
      }

      return;
    }

    const createdNode = createDomFromVdom(newChild);
    parentDom.insertBefore(createdNode, referenceNode);
    usedNodes.add(createdNode);
  });

  Array.from(parentDom.childNodes).forEach((childNode) => {
    if (!usedNodes.has(childNode)) {
      parentDom.removeChild(childNode);
    }
  });
}
