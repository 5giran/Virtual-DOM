/**
 * 역할:
 * - 화면에서 쓰는 DOM 요소 조회, 상태 표시 렌더링, HTML 비교 패널 렌더링을 담당합니다.
 * - MutationObserver도 여기에서 감싸서 UI 쪽 코드가 한 파일 안에서 보이도록 둡니다.
 *
 * 이 파일을 읽어야 하는 경우:
 * - 어떤 DOM id를 앱이 사용하는지 빠르게 찾고 싶을 때
 * - 변경 로그, history, HTML 비교 패널이 어떻게 그려지는지 보고 싶을 때
 *
 * 관련 파일:
 * - ../main.js: 이벤트를 묶고 UI 업데이트를 호출하는 시작점입니다.
 * - ../core/diff.js: 로그 표시용 change type과 요약 정보를 제공합니다.
 * - ../core/vdom.js: Virtual DOM을 실제 DOM/HTML로 렌더링합니다.
 */

import { CHANGE_TYPES, formatPath, summarizeChanges } from "../core/diff.js";
import { renderVdom, serializeVdom } from "../core/vdom.js";

export function getElements() {
  return {
    actualPreview: requiredElement("actual-preview"),
    actualSource: requiredElement("actual-source"),
    htmlBefore: requiredElement("html-before"),
    htmlAfter: requiredElement("html-after"),
    htmlBeforeLabel: requiredElement("html-before-label"),
    htmlAfterLabel: requiredElement("html-after-label"),
    testPreview: requiredElement("test-preview"),
    patchButton: requiredElement("patch-button"),
    undoButton: requiredElement("undo-button"),
    redoButton: requiredElement("redo-button"),
    changeCount: requiredElement("change-count"),
    mutationCount: requiredElement("mutation-count"),
    historyPosition: requiredElement("history-position"),
    historyTrack: requiredElement("history-track"),
    dirtyIndicator: requiredElement("dirty-indicator"),
    changeList: requiredElement("change-list"),
  };
}

export function createDomObserver(target) {
  const observer = new MutationObserver(() => {});

  observer.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });

  return {
    flush() {
      return observer.takeRecords().length;
    },

    disconnect() {
      observer.disconnect();
    },
  };
}

export function renderActualPreview(elements, vdom) {
  renderVdom(elements.actualPreview, vdom);
}

export function renderActualSource(elements, vdom) {
  elements.actualSource.textContent = serializeVdom(vdom);
}

export function renderTestPanel(elements, vdom) {
  renderVdom(elements.testPreview, vdom);
}

export function renderStatus(elements, store, isDirty) {
  const changes = store.getLastChanges();
  const summary = summarizeChanges(changes);
  const historyMeta = store.getHistoryMeta();

  elements.changeCount.textContent = String(summary.total);
  elements.mutationCount.textContent = String(store.getLastMutationCount());
  elements.historyPosition.textContent = `${historyMeta.index + 1} / ${historyMeta.size}`;
  elements.dirtyIndicator.textContent = isDirty ? "수정 중" : "동기화됨";
  renderHistoryTrack(elements.historyTrack, historyMeta.index, historyMeta.size);

  elements.undoButton.disabled = !store.canUndo();
  elements.redoButton.disabled = !store.canRedo();
}

export function renderChangeList(elements, changes) {
  const items = changes.length === 0 ? ["변경 없음"] : changes.map((change) => describeChange(change));

  elements.changeList.replaceChildren(
    ...items.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    }),
  );
}

export function renderHtmlComparison(
  elements,
  {
    beforeVdom,
    afterVdom,
    beforeLabel = "현재 Actual HTML",
    afterLabel = "현재 Test HTML",
  },
) {
  elements.htmlBeforeLabel.textContent = beforeLabel;
  elements.htmlAfterLabel.textContent = afterLabel;

  const beforeLines = toLines(beforeVdom ? serializeVdom(beforeVdom) : "");
  const afterLines = toLines(afterVdom ? serializeVdom(afterVdom) : "");
  const { beforeStates, afterStates } = diffSerializedLines(beforeLines, afterLines);

  renderCodePane(elements.htmlBefore, beforeLines, beforeStates);
  renderCodePane(elements.htmlAfter, afterLines, afterStates);
}

function requiredElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required element #${id} was not found.`);
  }

  return element;
}

function renderHistoryTrack(container, currentIndex, size) {
  container.replaceChildren(
    ...Array.from({ length: size }, (_, index) => {
      const item = document.createElement("span");
      item.className = "history-node";
      item.textContent = String(index + 1);

      if (index < currentIndex) {
        item.dataset.state = "past";
      } else if (index === currentIndex) {
        item.dataset.state = "current";
      } else {
        item.dataset.state = "future";
      }

      return item;
    }),
  );
}

function describeChange(change) {
  const path = formatPath(change.path);

  switch (change.type) {
    case CHANGE_TYPES.CREATE:
      return `[ADD] ${path}`;
    case CHANGE_TYPES.REMOVE:
      return `[REMOVE] ${path}`;
    case CHANGE_TYPES.REPLACE:
      return `[REPLACE] ${path}`;
    case CHANGE_TYPES.UPDATE_TEXT:
      return `[TEXT] ${path}`;
    case CHANGE_TYPES.SET_ATTRIBUTE:
      return `[ATTR+] ${path} · ${change.attribute}`;
    case CHANGE_TYPES.REMOVE_ATTRIBUTE:
      return `[ATTR-] ${path} · ${change.attribute}`;
    case CHANGE_TYPES.MOVE_CHILD:
      return `[MOVE] ${path} · key=${change.key} ${change.from} -> ${change.to}`;
    default:
      return `[UNKNOWN] ${path}`;
  }
}

function toLines(serialized) {
  if (!serialized) {
    return [];
  }

  return serialized.split("\n").filter((line) => line.trim().length > 0);
}

function diffSerializedLines(beforeLines, afterLines) {
  const beforeStates = Array(beforeLines.length).fill("removed");
  const afterStates = Array(afterLines.length).fill("added");
  const dp = Array.from({ length: beforeLines.length + 1 }, () =>
    Array(afterLines.length + 1).fill(0),
  );

  for (let beforeIndex = beforeLines.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = afterLines.length - 1; afterIndex >= 0; afterIndex -= 1) {
      if (beforeLines[beforeIndex] === afterLines[afterIndex]) {
        dp[beforeIndex][afterIndex] = dp[beforeIndex + 1][afterIndex + 1] + 1;
      } else {
        dp[beforeIndex][afterIndex] = Math.max(
          dp[beforeIndex + 1][afterIndex],
          dp[beforeIndex][afterIndex + 1],
        );
      }
    }
  }

  let beforeCursor = 0;
  let afterCursor = 0;

  while (beforeCursor < beforeLines.length && afterCursor < afterLines.length) {
    if (beforeLines[beforeCursor] === afterLines[afterCursor]) {
      beforeStates[beforeCursor] = "same";
      afterStates[afterCursor] = "same";
      beforeCursor += 1;
      afterCursor += 1;
      continue;
    }

    if (dp[beforeCursor + 1][afterCursor] >= dp[beforeCursor][afterCursor + 1]) {
      beforeCursor += 1;
    } else {
      afterCursor += 1;
    }
  }

  return { beforeStates, afterStates };
}

function renderCodePane(container, lines, states) {
  if (lines.length === 0) {
    const empty = document.createElement("div");
    empty.className = "code-line code-line--empty";
    empty.textContent = "비어 있음";
    container.replaceChildren(empty);
    return;
  }

  container.replaceChildren(
    ...lines.map((line, index) => {
      const row = document.createElement("div");
      const lineNumber = document.createElement("span");
      const lineText = document.createElement("code");

      row.className = `code-line code-line--${states[index] ?? "same"}`;
      lineNumber.className = "code-line-number";
      lineText.className = "code-line-text";

      lineNumber.textContent = String(index + 1);
      lineText.textContent = line || " ";

      row.append(lineNumber, lineText);
      return row;
    }),
  );
}
