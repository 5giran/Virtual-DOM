/**
 * 역할:
 * - 이전 Virtual DOM과 새로운 Virtual DOM을 바탕으로 실제 DOM을 부분 갱신합니다.
 * - diff 결과를 다시 직접 읽지 않아도 되도록, 실제 반영 로직을 한 파일에서 따라갈 수 있게 둡니다.
 *
 * 이 파일을 읽어야 하는 경우:
 * - Patch 버튼을 눌렀을 때 실제 DOM이 어떻게 바뀌는지 보고 싶을 때
 * - keyed child 재사용과 이동 로직을 이해하고 싶을 때
 *
 * 관련 파일:
 * - vdom.js: DOM 생성, 속성 동기화, key 추출 기능을 제공합니다.
 * - diff.js: 어떤 차이가 생겼는지 계산합니다.
 */

import { createDomFromVdom, getNodeKey, syncAttributes } from "./vdom.js";

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
