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
  // 화면에서 자주 쓰는 DOM 요소를 한 번에 찾아 모아둡니다.
  return {
    actualPreview: requiredElement("actual-preview"),
    actualSource: requiredElement("actual-source"),
    htmlBefore: requiredElement("html-before"),
    htmlAfter: requiredElement("html-after"),
    htmlBeforeLabel: requiredElement("html-before-label"),
    htmlAfterLabel: requiredElement("html-after-label"),
    htmlEditor: requiredElement("html-editor"),
    htmlApplyButton: requiredElement("html-apply-button"),
    htmlEditorStatus: requiredElement("html-editor-status"),
    testPreview: requiredElement("test-preview"),
    patchButton: requiredElement("patch-button"),
    undoButton: requiredElement("undo-button"),
    redoButton: requiredElement("redo-button"),
    editModeButton: requiredElement("edit-mode-button"),
    changeCount: requiredElement("change-count"),
    mutationCount: requiredElement("mutation-count"),
    historyPosition: requiredElement("history-position"),
    historyTrack: requiredElement("history-track"),
    dirtyIndicator: requiredElement("dirty-indicator"),
    changeList: requiredElement("change-list"),
  };
}

export function createDomObserver(target) {
  // 실제 DOM이 얼마나 바뀌었는지 세기 위한 MutationObserver wrapper입니다.
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
  // 실제 영역을 currentVdom 기준으로 렌더링합니다.
  renderVdom(elements.actualPreview, vdom);
}

export function renderActualSource(elements, vdom) {
  // 현재 actual VDOM을 HTML 문자열로 보여줍니다.
  elements.actualSource.textContent = serializeVdom(vdom);
}

export function renderTestPanel(elements, vdom) {
  // 테스트 영역을 draftVdom 기준으로 렌더링합니다.
  renderVdom(elements.testPreview, vdom);
}

export function renderDraftSource(elements, vdom) {
  // 현재 draft VDOM을 HTML 편집기 문자열로 보여줍니다.
  elements.htmlEditor.value = serializeVdom(vdom);
}

export function renderHtmlEditorStatus(elements, message, state = "idle") {
  // HTML 편집기의 현재 상태를 짧은 문구로 보여줍니다.
  elements.htmlEditorStatus.textContent = message;
  elements.htmlEditorStatus.dataset.state = state;
}

export function renderStatus(
  elements,
  store,
  isDirty,
  onHistoryNodeClick,
  changes = store.getLastChanges(),
) {
  // 상단 메트릭, 버튼 비활성화, history 트랙 상태를 갱신합니다.
  const summary = summarizeChanges(changes);
  const historyMeta = store.getHistoryMeta();

  elements.changeCount.textContent = String(summary.total);
  elements.mutationCount.textContent = String(store.getLastMutationCount());
  elements.historyPosition.textContent = `${historyMeta.index + 1} / ${historyMeta.size}`;
  elements.dirtyIndicator.textContent = isDirty ? "수정 중" : "동기화됨";
  renderHistoryTrack(elements.historyTrack, historyMeta.index, historyMeta.size, onHistoryNodeClick);

  elements.undoButton.disabled = !store.canUndo();
  elements.redoButton.disabled = !store.canRedo();
}

export function renderChangeList(elements, changes) {
  // diff 결과를 자바스크립트 코드처럼 읽히는 changes 배열 형태로 보여줍니다.
  elements.changeList.textContent = serializeChangesAsCode(changes);
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
  // 이전/현재 HTML을 줄 단위로 비교해서 하이라이트 패널에 그립니다.
  elements.htmlBeforeLabel.textContent = beforeLabel;
  elements.htmlAfterLabel.textContent = afterLabel;

  const beforeLines = toLines(beforeVdom ? serializeVdom(beforeVdom) : "");
  const afterLines = toLines(afterVdom ? serializeVdom(afterVdom) : "");
  const { beforeStates, afterStates } = diffSerializedLines(beforeLines, afterLines);

  renderCodePane(elements.htmlBefore, beforeLines, beforeStates);
  renderCodePane(elements.htmlAfter, afterLines, afterStates);
}

function requiredElement(id) {
  // 필수 DOM이 없으면 바로 에러를 내서 문제를 빨리 찾게 합니다.
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required element #${id} was not found.`);
  }

  return element;
}

function renderHistoryTrack(container, currentIndex, size, onNodeClick) {
  // history를 숫자 점 형태로 그리고 클릭 이벤트를 연결합니다.
  const inspectingIndex = Number.parseInt(container.dataset.inspectingIndex ?? "", 10);

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

      if (Number.isInteger(inspectingIndex) && inspectingIndex === index && index !== currentIndex) {
        item.dataset.inspecting = "true";
      }

      if (typeof onNodeClick === "function") {
        item.addEventListener("click", () => {
          onNodeClick(index);
        });
      }

      return item;
    }),
  );
}

function describeChange(change) {
  // change 객체 하나를 로그용 짧은 문장으로 바꿉니다.
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

function serializeChangesAsCode(changes) {
  if (changes.length === 0) {
    return "const changes = [];";
  }

  const normalized = changes.map((change) => normalizeChangeForCode(change));
  return `const changes = ${JSON.stringify(normalized, null, 2)};`;
}

function normalizeChangeForCode(change) {
  const normalized = {};

  for (const [key, value] of Object.entries(change)) {
    if (key === "prevNode" || key === "nextNode") {
      normalized[key] = summarizeVNode(value);
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

function summarizeVNode(node) {
  if (!node) {
    return null;
  }

  if (node.type === "text") {
    return {
      type: "text",
      value: node.value,
    };
  }

  if (node.type === "fragment") {
    return {
      type: "fragment",
      childCount: node.children?.length ?? 0,
    };
  }

  return {
    type: node.type,
    tagName: node.tagName,
    attrs: node.attrs ?? {},
    childCount: node.children?.length ?? 0,
  };
}

function toLines(serialized) {
  // HTML 문자열을 줄 배열로 바꿔 비교하기 쉽게 만듭니다.
  if (!serialized) {
    return [];
  }

  return serialized.split("\n").filter((line) => line.trim().length > 0);
}

function diffSerializedLines(beforeLines, afterLines) {
  // 두 HTML 문자열을 줄 기준으로 비교해서 추가/삭제/동일 상태를 구합니다.
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
  // 코드 비교 패널 한쪽(before 또는 after)을 실제 DOM으로 그립니다.
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
