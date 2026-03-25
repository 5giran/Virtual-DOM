import { CHANGE_TYPES } from "./changeTypes.js";
import { getNodeKey } from "../../utils/nodeKey.js";

export function diffTrees(oldVdom, newVdom) {
  const changes = [];
  walk(oldVdom, newVdom, [], changes);
  return changes;
}

export function summarizeChanges(changes) {
  return changes.reduce((summary, change) => {
    summary.total += 1;
    summary.byType[change.type] = (summary.byType[change.type] ?? 0) + 1;
    return summary;
  }, { total: 0, byType: {} });
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

  return (
    nodes.length > 0 &&
    nodes.every((node) => node.type === "element" && getNodeKey(node))
  );
}
