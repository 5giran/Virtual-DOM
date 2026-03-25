/**
 * 역할:
 * - 현재 Virtual DOM 상태와 history(undo/redo)를 함께 관리합니다.
 * - 마지막 diff 결과와 실제 DOM mutation 개수도 같이 저장해서 UI가 바로 읽을 수 있게 합니다.
 *
 * 이 파일을 읽어야 하는 경우:
 * - Patch 이후 어떤 상태가 저장되는지 알고 싶을 때
 * - undo / redo가 어떤 기준으로 움직이는지 확인하고 싶을 때
 *
 * 관련 파일:
 * - ../main.js: Patch / Undo / Redo 이벤트에서 이 store를 사용합니다.
 * - ../core/vdom.js: history에 저장할 Virtual DOM을 복제할 때 사용합니다.
 */

import { cloneVdom } from "../core/vdom.js";

export function createStore(initialVdom) {
  const history = createHistory(initialVdom);
  let currentVdom = cloneVdom(initialVdom);
  let lastChanges = [];
  let lastMutationCount = 0;

  return {
    getCurrentVdom() {
      return cloneVdom(currentVdom);
    },

    getLastChanges() {
      return [...lastChanges];
    },

    getLastMutationCount() {
      return lastMutationCount;
    },

    getSnapshotAt(index) {
      return history.snapshotAt(index);
    },

    commit(nextVdom, changes, mutationCount) {
      const previousVdom = cloneVdom(currentVdom);
      currentVdom = cloneVdom(nextVdom);
      history.push({
        vdom: currentVdom,
        previousVdom,
        changes,
        mutationCount,
      });
      lastChanges = [...changes];
      lastMutationCount = mutationCount;
    },

    inspect(changes, mutationCount) {
      lastChanges = [...changes];
      lastMutationCount = mutationCount;
    },

    undo() {
      const previous = history.undo();

      if (!previous) {
        return null;
      }

      currentVdom = cloneVdom(previous);
      lastChanges = [];
      lastMutationCount = 0;
      return cloneVdom(currentVdom);
    },

    redo() {
      const next = history.redo();

      if (!next) {
        return null;
      }

      currentVdom = cloneVdom(next);
      lastChanges = [];
      lastMutationCount = 0;
      return cloneVdom(currentVdom);
    },

    canUndo() {
      return history.canUndo();
    },

    canRedo() {
      return history.canRedo();
    },

    getHistoryMeta() {
      return {
        index: history.index(),
        size: history.size(),
      };
    },
  };
}

export function createHistory(initialVdom) {
  let entries = [createSnapshot(initialVdom)];
  let cursor = 0;

  return {
    push(nextEntry) {
      entries = entries.slice(0, cursor + 1);
      const previousSnapshot = entries[cursor] ?? null;
      const snapshot = toSnapshot(nextEntry, previousSnapshot?.vdom ?? null);

      entries.push(snapshot);
      cursor = entries.length - 1;
    },

    undo() {
      if (cursor === 0) {
        return null;
      }

      cursor -= 1;
      return cloneVdom(entries[cursor].vdom);
    },

    redo() {
      if (cursor >= entries.length - 1) {
        return null;
      }

      cursor += 1;
      return cloneVdom(entries[cursor].vdom);
    },

    current() {
      return cloneVdom(entries[cursor].vdom);
    },

    snapshotAt(index) {
      return cloneSnapshot(entries[index] ?? null);
    },

    canUndo() {
      return cursor > 0;
    },

    canRedo() {
      return cursor < entries.length - 1;
    },

    size() {
      return entries.length;
    },

    index() {
      return cursor;
    },
  };
}

function createSnapshot(vdom, previousVdom = vdom, changes = [], mutationCount = 0) {
  return {
    vdom: cloneVdom(vdom),
    previousVdom: cloneVdom(previousVdom ?? vdom),
    changes: cloneChanges(changes),
    mutationCount,
  };
}

function toSnapshot(entry, previousVdom) {
  if (isSnapshotEntry(entry)) {
    return createSnapshot(
      entry.vdom,
      entry.previousVdom ?? previousVdom ?? entry.vdom,
      entry.changes ?? [],
      entry.mutationCount ?? 0,
    );
  }

  return createSnapshot(entry, previousVdom ?? entry);
}

function isSnapshotEntry(entry) {
  return Boolean(entry && typeof entry === "object" && "vdom" in entry);
}

function cloneSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    vdom: cloneVdom(snapshot.vdom),
    previousVdom: cloneVdom(snapshot.previousVdom),
    changes: cloneChanges(snapshot.changes),
    mutationCount: snapshot.mutationCount,
  };
}

function cloneChanges(changes = []) {
  return JSON.parse(JSON.stringify(changes));
}
