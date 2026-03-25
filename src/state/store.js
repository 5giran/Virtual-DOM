/**
 * 역할:
 * - 현재 실제 상태 Virtual DOM과 테스트용 draft Virtual DOM을 함께 관리합니다.
 * - 마지막 diff 결과와 실제 DOM mutation 개수도 같이 저장해서 UI가 바로 읽을 수 있게 합니다.
 *
 * 이 파일을 읽어야 하는 경우:
 * - Patch 이후 어떤 상태가 저장되는지 알고 싶을 때
 * - 실제 상태(actual)와 테스트 상태(draft)가 어떻게 분리되는지 보고 싶을 때
 * - undo / redo가 어떤 기준으로 움직이는지 확인하고 싶을 때
 *
 * 관련 파일:
 * - ../main.js: Patch / Undo / Redo 이벤트에서 이 store를 사용합니다.
 * - ../core/vdom.js: history에 저장할 Virtual DOM을 복제할 때 사용합니다.
 */

import { cloneVdom } from "../core/vdom.js";

export function createStore(initialVdom) {
  // 앱 전체에서 쓰는 현재 상태 / 테스트 상태 / history를 한곳에 담습니다.
  const history = createHistory(initialVdom);
  let currentVdom = cloneVdom(initialVdom);
  let draftVdom = cloneVdom(initialVdom);
  let lastChanges = [];
  let lastMutationCount = 0;

  return {
    // 실제 영역의 기준이 되는 현재 VDOM을 읽습니다.
    getCurrentVdom() {
      return cloneVdom(currentVdom);
    },

    // 테스트 영역의 기준이 되는 draft VDOM을 읽습니다.
    getDraftVdom() {
      return cloneVdom(draftVdom);
    },

    // draft VDOM을 새 값으로 교체합니다.
    setDraftVdom(nextVdom) {
      draftVdom = cloneVdom(nextVdom);
    },

    // draft를 현재 실제 상태와 다시 같게 맞춥니다.
    resetDraftVdom() {
      draftVdom = cloneVdom(currentVdom);
    },

    // 마지막 diff 결과를 UI가 읽을 수 있게 돌려줍니다.
    getLastChanges() {
      return [...lastChanges];
    },

    // 마지막 Patch에서 실제 DOM이 몇 번 바뀌었는지 돌려줍니다.
    getLastMutationCount() {
      return lastMutationCount;
    },

    // history의 특정 시점 snapshot을 읽습니다.
    getSnapshotAt(index) {
      return history.snapshotAt(index);
    },

    // 원하는 history 시점으로 바로 이동하고 actual/draft를 함께 맞춥니다.
    jumpTo(index) {
      const snapshot = history.jumpTo(index);

      if (!snapshot) {
        return null;
      }

      currentVdom = cloneVdom(snapshot.vdom);
      draftVdom = cloneVdom(snapshot.vdom);
      lastChanges = [];
      lastMutationCount = 0;
      return cloneSnapshot(snapshot);
    },

    // 현재 draft를 실제 상태로 확정하고 history에 저장합니다.
    commitDraft(changes, mutationCount) {
      const previousVdom = cloneVdom(currentVdom);
      currentVdom = cloneVdom(draftVdom);
      history.push({
        vdom: currentVdom,
        previousVdom,
        changes,
        mutationCount,
      });
      lastChanges = [...changes];
      lastMutationCount = mutationCount;

      return {
        previousVdom,
        currentVdom: cloneVdom(currentVdom),
      };
    },

    // 예전 테스트 코드와의 호환을 위해 남겨둔 commit wrapper입니다.
    commit(nextVdom, changes, mutationCount) {
      draftVdom = cloneVdom(nextVdom);
      return this.commitDraft(changes, mutationCount);
    },

    // history를 움직이지 않고 마지막 변경 정보만 잠깐 보여줄 때 씁니다.
    inspect(changes, mutationCount) {
      lastChanges = [...changes];
      lastMutationCount = mutationCount;
    },

    // 이전 history 시점으로 이동하고 actual/draft를 함께 맞춥니다.
    undo() {
      const previous = history.undo();

      if (!previous) {
        return null;
      }

      currentVdom = cloneVdom(previous);
      draftVdom = cloneVdom(previous);
      lastChanges = [];
      lastMutationCount = 0;
      return cloneVdom(currentVdom);
    },

    // 다음 history 시점으로 이동하고 actual/draft를 함께 맞춥니다.
    redo() {
      const next = history.redo();

      if (!next) {
        return null;
      }

      currentVdom = cloneVdom(next);
      draftVdom = cloneVdom(next);
      lastChanges = [];
      lastMutationCount = 0;
      return cloneVdom(currentVdom);
    },

    // 뒤로가기 가능 여부를 알려줍니다.
    canUndo() {
      return history.canUndo();
    },

    // 앞으로가기 가능 여부를 알려줍니다.
    canRedo() {
      return history.canRedo();
    },

    // history의 현재 위치와 전체 길이를 UI에 넘겨줍니다.
    getHistoryMeta() {
      return {
        index: history.index(),
        size: history.size(),
      };
    },
  };
}

export function createHistory(initialVdom) {
  // undo / redo가 움직일 history 배열과 커서를 관리합니다.
  let entries = [createSnapshot(initialVdom)];
  let cursor = 0;

  return {
    // 새 상태를 현재 위치 뒤에 추가하고, 미래 기록은 잘라냅니다.
    push(nextEntry) {
      entries = entries.slice(0, cursor + 1);
      const previousSnapshot = entries[cursor] ?? null;
      const snapshot = toSnapshot(nextEntry, previousSnapshot?.vdom ?? null);

      entries.push(snapshot);
      cursor = entries.length - 1;
    },

    // history 커서를 한 칸 뒤로 옮깁니다.
    undo() {
      if (cursor === 0) {
        return null;
      }

      cursor -= 1;
      return cloneVdom(entries[cursor].vdom);
    },

    // history 커서를 한 칸 앞으로 옮깁니다.
    redo() {
      if (cursor >= entries.length - 1) {
        return null;
      }

      cursor += 1;
      return cloneVdom(entries[cursor].vdom);
    },

    // 현재 history 위치의 VDOM을 읽습니다.
    current() {
      return cloneVdom(entries[cursor].vdom);
    },

    // 원하는 위치의 snapshot 전체 정보를 읽습니다.
    snapshotAt(index) {
      return cloneSnapshot(entries[index] ?? null);
    },

    // history 커서를 원하는 위치로 옮기고 snapshot을 반환합니다.
    jumpTo(index) {
      if (!Number.isInteger(index) || index < 0 || index >= entries.length) {
        return null;
      }

      cursor = index;
      return cloneSnapshot(entries[cursor]);
    },

    // 더 뒤로 갈 수 있는지 확인합니다.
    canUndo() {
      return cursor > 0;
    },

    // 더 앞으로 갈 수 있는지 확인합니다.
    canRedo() {
      return cursor < entries.length - 1;
    },

    // history 길이를 반환합니다.
    size() {
      return entries.length;
    },

    // 현재 커서 위치를 반환합니다.
    index() {
      return cursor;
    },
  };
}

function createSnapshot(vdom, previousVdom = vdom, changes = [], mutationCount = 0) {
  // 한 시점의 상태를 UI가 보기 쉽게 snapshot 형태로 고정해 둡니다.
  return {
    vdom: cloneVdom(vdom),
    previousVdom: cloneVdom(previousVdom ?? vdom),
    changes: cloneChanges(changes),
    mutationCount,
  };
}

function toSnapshot(entry, previousVdom) {
  // 다양한 입력 형태를 항상 같은 snapshot 구조로 정리합니다.
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
  // 이미 snapshot 모양인지 확인하는 간단한 체크입니다.
  return Boolean(entry && typeof entry === "object" && "vdom" in entry);
}

function cloneSnapshot(snapshot) {
  // snapshot을 복사해서 바깥 코드가 history 원본을 건드리지 않게 합니다.
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
  // change 배열도 깊은 복사해서 안전하게 보관합니다.
  return JSON.parse(JSON.stringify(changes));
}
