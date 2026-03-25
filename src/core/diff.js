/**
 * 역할:
 * - 이전 Virtual DOM과 새로운 Virtual DOM을 비교해서 변경 목록을 만듭니다.
 * - 텍스트, 속성, 노드 추가/삭제/교체, keyed child 이동까지 한 파일에서 볼 수 있게 모아둡니다.
 *
 * 이 파일을 읽어야 하는 경우:
 * - diff 알고리즘이 어떤 케이스를 감지하는지 빠르게 이해하고 싶을 때
 * - 변경 로그가 어떤 기준으로 생성되는지 보고 싶을 때
 *
 * 관련 파일:
 * - vdom.js: 비교 대상이 되는 Virtual DOM 구조를 만듭니다.
 * - patch.js: 여기서 만든 차이를 실제 DOM 반영에 활용합니다.
 */

import { getNodeKey } from "./vdom.js";

export const CHANGE_TYPES = {
  CREATE: "CREATE_NODE",
  REMOVE: "REMOVE_NODE",
  REPLACE: "REPLACE_NODE",
  UPDATE_TEXT: "UPDATE_TEXT",
  SET_ATTRIBUTE: "SET_ATTRIBUTE",
  REMOVE_ATTRIBUTE: "REMOVE_ATTRIBUTE",
  MOVE_CHILD: "MOVE_CHILD",
};

export function diffTrees(oldVdom, newVdom) {
  const changes = [];
  walk(oldVdom, newVdom, [], changes);
  return changes;
}

export function summarizeChanges(changes) {
  return changes.reduce(
    (summary, change) => {
      summary.total += 1;
      summary.byType[change.type] = (summary.byType[change.type] ?? 0) + 1;
      return summary;
    },
    { total: 0, byType: {} },
  );
}

export function formatPath(path) {
  return path.length === 0 ? "root" : path.join(" > ");
}

function walk(oldNode, newNode, path, changes) {
  if (!oldNode && newNode) {
    changes.push({ type: CHANGE_TYPES.CREATE, path, nextNode: newNode });
    return;
  }

  if (oldNode && !newNode) {
    changes.push({ type: CHANGE_TYPES.REMOVE, path, prevNode: oldNode });
    return;
  }

  if (!oldNode || !newNode) {
    return;
  }

  if (oldNode.type !== newNode.type) {
    changes.push({ type: CHANGE_TYPES.REPLACE, path, prevNode: oldNode, nextNode: newNode });
    return;
  }

  if (oldNode.type === "fragment") {
    diffChildren(oldNode.children ?? [], newNode.children ?? [], path, changes);
    return;
  }

  if (oldNode.type === "text") {
    if (oldNode.value !== newNode.value) {
      changes.push({
        type: CHANGE_TYPES.UPDATE_TEXT,
        path,
        prevValue: oldNode.value,
        nextValue: newNode.value,
      });
    }

    return;
  }

  if (oldNode.tagName !== newNode.tagName) {
    changes.push({ type: CHANGE_TYPES.REPLACE, path, prevNode: oldNode, nextNode: newNode });
    return;
  }

  diffAttributes(oldNode.attrs ?? {}, newNode.attrs ?? {}, path, changes);
  diffChildren(oldNode.children ?? [], newNode.children ?? [], path, changes);
}

function diffAttributes(oldAttrs, newAttrs, path, changes) {
  for (const [name, value] of Object.entries(newAttrs)) {
    if (oldAttrs[name] !== value) {
      changes.push({
        type: CHANGE_TYPES.SET_ATTRIBUTE,
        path,
        attribute: name,
        prevValue: oldAttrs[name],
        nextValue: value,
      });
    }
  }

  for (const name of Object.keys(oldAttrs)) {
    if (!(name in newAttrs)) {
      changes.push({
        type: CHANGE_TYPES.REMOVE_ATTRIBUTE,
        path,
        attribute: name,
        prevValue: oldAttrs[name],
      });
    }
  }
}

function diffChildren(oldChildren, newChildren, parentPath, changes) {
  if (supportsKeyedDiff(oldChildren, newChildren)) {
    diffKeyedChildren(oldChildren, newChildren, parentPath, changes);
    return;
  }

  const maxLength = Math.max(oldChildren.length, newChildren.length);

  for (let index = 0; index < maxLength; index += 1) {
    walk(oldChildren[index], newChildren[index], parentPath.concat(index), changes);
  }
}

function diffKeyedChildren(oldChildren, newChildren, parentPath, changes) {
  const oldMap = new Map();
  const seenKeys = new Set();

  oldChildren.forEach((child, index) => {
    oldMap.set(getNodeKey(child), { child, index });
  });

  newChildren.forEach((child, newIndex) => {
    const key = getNodeKey(child);
    const match = oldMap.get(key);

    if (!match) {
      changes.push({
        type: CHANGE_TYPES.CREATE,
        path: parentPath.concat(newIndex),
        nextNode: child,
        key,
      });
      return;
    }

    if (match.index !== newIndex) {
      changes.push({
        type: CHANGE_TYPES.MOVE_CHILD,
        path: parentPath,
        key,
        from: match.index,
        to: newIndex,
      });
    }

    seenKeys.add(key);
    walk(match.child, child, parentPath.concat(newIndex), changes);
  });

  oldChildren.forEach((child, oldIndex) => {
    const key = getNodeKey(child);

    if (!seenKeys.has(key)) {
      changes.push({
        type: CHANGE_TYPES.REMOVE,
        path: parentPath.concat(oldIndex),
        prevNode: child,
        key,
      });
    }
  });
}

function supportsKeyedDiff(oldChildren, newChildren) {
  const nodes = [...oldChildren, ...newChildren].filter(Boolean);

  return nodes.length > 0 && nodes.every((node) => node.type === "element" && getNodeKey(node));
}
