/**
 * 역할:
 * - 앱의 시작점입니다.
 * - Patch / Undo / Redo 이벤트를 묶고, 테스트 영역 편집 흐름을 연결합니다.
 * - 처음 읽는 팀원이 "이 프로젝트가 어떻게 움직이는지" 가장 먼저 보기 좋은 파일입니다.
 *
 * 이 파일을 읽어야 하는 경우:
 * - 전체 실행 흐름을 빠르게 파악하고 싶을 때
 * - 버튼을 누르면 어떤 순서로 DOM -> VDOM -> Diff -> Patch가 일어나는지 보고 싶을 때
 *
 * 관련 파일:
 * - ./ui/appUi.js: 화면 렌더링과 DOM 요소 연결
 * - ./core/vdom.js: DOM <-> Virtual DOM 변환
 * - ./core/diff.js: 이전/새 Virtual DOM 비교
 * - ./core/patch.js: 실제 DOM 반영
 * - ./state/store.js: history, undo/redo 상태 관리
 */

import { diffTrees } from "./core/diff.js";
import { patchDom } from "./core/patch.js";
import { domToVdom, sanitizeHtml } from "./core/vdom.js";
import {
  createDomObserver,
  getElements,
  renderActualPreview,
  renderActualSource,
  renderChangeList,
  renderHtmlComparison,
  renderStatus,
  renderTestPanel,
} from "./ui/appUi.js";
import { createStore } from "./state/store.js";
import { sampleMarkup } from "./sampleMarkup.js";

const EDITABLE_FIELD_SELECTOR = ['[data-role="title"]', '[data-role="description"]', ".sample-value"].join(
  ", ",
);

document.addEventListener("DOMContentLoaded", () => {
  const elements = getElements();
  const editModeButton = requiredElement("edit-mode-button");
  const initialVdom = createInitialVdom(elements);
  const store = createStore(initialVdom);
  const observer = createDomObserver(elements.actualPreview);
  let isDirty = false;
  let isEditModeEnabled = false;
  let inspectedHistoryIndex = null;

  setupTestPreviewEditor(
    elements,
    store,
    () => {
      isDirty = true;
      clearHistoryInspection();
      renderStatus(elements, store, isDirty, handleHistoryNodeClick);
    },
    () => isEditModeEnabled,
  );
  syncEditModeButton(editModeButton, isEditModeEnabled);
  decorateTestPreview(elements, isEditModeEnabled);

  observer.flush();
  renderStatus(elements, store, isDirty, handleHistoryNodeClick);
  renderChangeList(elements, store.getLastChanges());
  syncDraftPanels(elements, store);

  editModeButton.addEventListener("click", () => {
    isEditModeEnabled = !isEditModeEnabled;
    syncEditModeButton(editModeButton, isEditModeEnabled);
    decorateTestPreview(elements, isEditModeEnabled);
  });

  elements.patchButton.addEventListener("click", () => {
    const nextVdom = createDraftVdom(elements.testPreview);
    const previousVdom = store.getCurrentVdom();
    const changes = diffTrees(previousVdom, nextVdom);

    if (changes.length === 0) {
      store.inspect([], 0);
      isDirty = false;
      clearHistoryInspection();
      renderStatus(elements, store, isDirty, handleHistoryNodeClick);
      renderChangeList(elements, []);
      renderHtmlComparison(elements, {
        beforeVdom: previousVdom,
        afterVdom: nextVdom,
        beforeLabel: "현재 Actual HTML",
        afterLabel: "현재 Test HTML",
      });
      return;
    }

    patchDom(elements.actualPreview, previousVdom, nextVdom);
    const mutationCount = observer.flush();

    store.commit(nextVdom, changes, mutationCount);
    renderActualSource(elements, nextVdom);
    renderTestPanel(elements, nextVdom);
    decorateTestPreview(elements, isEditModeEnabled);
    renderHtmlComparison(elements, {
      beforeVdom: previousVdom,
      afterVdom: nextVdom,
      beforeLabel: "Patch 전 HTML",
      afterLabel: "Patch 후 HTML",
    });

    isDirty = false;
    clearHistoryInspection();
    renderStatus(elements, store, isDirty, handleHistoryNodeClick);
    renderChangeList(elements, changes);
  });

  elements.undoButton.addEventListener("click", () => {
    const currentState = store.getCurrentVdom();
    const previousState = store.undo();

    if (!previousState) {
      return;
    }

    patchDom(elements.actualPreview, domToVdom(elements.actualPreview), previousState);
    const changes = diffTrees(currentState, previousState);
    const mutationCount = observer.flush();
    store.inspect(changes, mutationCount);
    renderActualSource(elements, previousState);
    renderTestPanel(elements, previousState);
    decorateTestPreview(elements, isEditModeEnabled);
    renderHtmlComparison(elements, {
      beforeVdom: currentState,
      afterVdom: previousState,
      beforeLabel: "Undo 전 HTML",
      afterLabel: "Undo 결과 HTML",
    });

    isDirty = false;
    clearHistoryInspection();
    renderStatus(elements, store, isDirty, handleHistoryNodeClick);
    renderChangeList(elements, changes);
  });

  elements.redoButton.addEventListener("click", () => {
    const currentState = store.getCurrentVdom();
    const nextState = store.redo();

    if (!nextState) {
      return;
    }

    patchDom(elements.actualPreview, domToVdom(elements.actualPreview), nextState);
    const changes = diffTrees(currentState, nextState);
    const mutationCount = observer.flush();
    store.inspect(changes, mutationCount);
    renderActualSource(elements, nextState);
    renderTestPanel(elements, nextState);
    decorateTestPreview(elements, isEditModeEnabled);
    renderHtmlComparison(elements, {
      beforeVdom: currentState,
      afterVdom: nextState,
      beforeLabel: "Redo 전 HTML",
      afterLabel: "Redo 결과 HTML",
    });

    isDirty = false;
    clearHistoryInspection();
    renderStatus(elements, store, isDirty, handleHistoryNodeClick);
    renderChangeList(elements, changes);
  });

  function handleHistoryNodeClick(index) {
    const snapshot = store.getSnapshotAt(index);

    if (!snapshot) {
      return;
    }

    const historyMeta = store.getHistoryMeta();

    if (index === historyMeta.index) {
      clearHistoryInspection();
      renderStatus(elements, store, isDirty, handleHistoryNodeClick);
      renderChangeList(elements, store.getLastChanges());
      renderHtmlComparison(elements, {
        beforeVdom: snapshot.previousVdom,
        afterVdom: snapshot.vdom,
        beforeLabel: "현재 Actual HTML",
        afterLabel: "현재 Test HTML",
      });
      return;
    }

    inspectedHistoryIndex = index;
    syncHistoryInspection(elements, inspectedHistoryIndex);
    renderStatus(elements, store, isDirty, handleHistoryNodeClick);
    renderChangeList(elements, snapshot.changes);
    renderHtmlComparison(elements, {
      beforeVdom: snapshot.previousVdom,
      afterVdom: snapshot.vdom,
      beforeLabel: `[${index + 1}] 이전 HTML`,
      afterLabel: `[${index + 1}] 변경 후 HTML`,
    });
  }

  function clearHistoryInspection() {
    inspectedHistoryIndex = null;
    syncHistoryInspection(elements, inspectedHistoryIndex);
  }
});

function createInitialVdom(elements) {
  elements.actualPreview.innerHTML = sanitizeHtml(sampleMarkup);
  const initialVdom = domToVdom(elements.actualPreview);

  renderActualPreview(elements, initialVdom);
  renderActualSource(elements, initialVdom);
  renderTestPanel(elements, initialVdom);
  renderHtmlComparison(elements, {
    beforeVdom: initialVdom,
    afterVdom: initialVdom,
    beforeLabel: "현재 Actual HTML",
    afterLabel: "현재 Test HTML",
  });

  return initialVdom;
}

function setupTestPreviewEditor(elements, store, onDirty, getEditMode) {
  elements.testPreview.addEventListener("click", (event) => {
    const control = event.target.closest("[data-editor-control][data-action]");

    if (!control) {
      return;
    }

    event.preventDefault();

    withDraftRoot(elements.testPreview, (root) => {
      handleEditorAction(root, control.dataset.action, control, elements, store, onDirty, getEditMode);
    });
  });

  elements.testPreview.addEventListener(
    "keydown",
    (event) => {
      const target = event.target.closest("[data-editor-editing='true']");

      if (!target) {
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        target.blur();
      }
    },
    true,
  );

  elements.testPreview.addEventListener(
    "focusout",
    (event) => {
      const target = event.target.closest("[data-editor-editing='true']");

      if (!target) {
        return;
      }

      finishInlineEdit(target);
      if (getEditMode()) {
        setTestPreviewEditMode(elements.testPreview, true);
      }
      syncDraftPanels(elements, store);
      onDirty();
    },
    true,
  );
}

function handleEditorAction(root, action, control, elements, store, onDirty, getEditMode) {
  switch (action) {
    case "toggle-color":
      toggleTheme(root);
      break;
    case "toggle-replace":
      toggleReplaceTarget(root);
      break;
    case "add-item":
      addListItem(root);
      break;
    case "delete-item":
      control.closest("li")?.remove();
      break;
    case "move-up":
      moveListItem(control.closest("li"), -1);
      break;
    case "move-down":
      moveListItem(control.closest("li"), 1);
      break;
    default:
      return;
  }

  decorateTestPreview(elements, getEditMode());
  syncDraftPanels(elements, store);
  onDirty();
}

function withDraftRoot(container, callback) {
  const root = container.firstElementChild;

  if (!root) {
    return;
  }

  callback(root);
}

function decorateTestPreview(elements, isEditModeEnabled = false) {
  withDraftRoot(elements.testPreview, (root) => {
    root.querySelectorAll("[data-editor-control]").forEach((node) => node.remove());

    const list = root.querySelector(".sample-list");
    const row = root.querySelector(".sample-row");

    if (!isEditModeEnabled) {
      return;
    }

    if (row) {
      row.append(
        createControlGroup(
          [createControlButton("색상 변경", "toggle-color"), createControlButton("태그 교체", "toggle-replace")],
          "editor-controls--row",
        ),
      );
    }

    if (list) {
      Array.from(list.children).forEach((item) => {
        item.append(
          createControlGroup(
            [
              createControlButton("삭제", "delete-item"),
              createControlButton("위로", "move-up"),
              createControlButton("아래로", "move-down"),
            ],
            "editor-controls--item",
          ),
        );
      });

      list.after(
        createControlGroup([createControlButton("항목 추가", "add-item")], "editor-controls--footer"),
      );
    }
  });

  setTestPreviewEditMode(elements.testPreview, isEditModeEnabled);
}

function syncDraftPanels(elements, store) {
  const currentVdom = store.getCurrentVdom();
  const draftVdom = createDraftVdom(elements.testPreview);

  renderHtmlComparison(elements, {
    beforeVdom: currentVdom,
    afterVdom: draftVdom,
    beforeLabel: "현재 Actual HTML",
    afterLabel: "현재 Test HTML",
  });
}

function createControlGroup(buttons, extraClass = "") {
  const group = document.createElement("div");
  group.className = `editor-controls ${extraClass}`.trim();
  group.dataset.editorControl = "true";
  group.append(...buttons);
  return group;
}

function createControlButton(label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "editor-action";
  button.dataset.editorControl = "true";
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function finishInlineEdit(target) {
  const normalized = target.textContent.replace(/\s+/g, " ").trim();

  target.textContent = normalized || "내용 없음";
  target.removeAttribute("contenteditable");
  target.removeAttribute("spellcheck");
  delete target.dataset.editorEditing;
}

function toggleTheme(root) {
  const themeTag = root.querySelector('[data-role="theme-tag"]');
  const themes = ["theme-blue", "theme-emerald", "theme-amber"];
  const currentTheme = themes.find((theme) => root.classList.contains(theme)) ?? themes[0];
  const nextTheme = themes[(themes.indexOf(currentTheme) + 1) % themes.length];

  root.classList.remove(...themes);
  root.classList.add(nextTheme);

  if (themeTag) {
    themeTag.textContent = nextTheme;
  }
}

function toggleReplaceTarget(root) {
  const current = root.querySelector('[data-role="replace-target"]');

  if (!current) {
    return;
  }

  if (current.tagName.toLowerCase() === "button") {
    const link = document.createElement("a");
    link.href = "#";
    link.className = "sample-button sample-button--link";
    link.dataset.role = "replace-target";
    link.textContent = "link";
    current.replaceWith(link);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "sample-button";
  button.dataset.role = "replace-target";
  button.textContent = "button";
  current.replaceWith(button);
}

function addListItem(root) {
  const list = root.querySelector(".sample-list");

  if (!list) {
    return;
  }

  const item = document.createElement("li");
  const key = createNextItemKey(list);

  item.dataset.key = key;
  item.innerHTML = `<strong class="sample-key">${key}</strong><span class="sample-value">새 항목</span>`;
  list.append(item);
}

function createNextItemKey(list) {
  const existingKeys = new Set(
    Array.from(list.children).map((item) => item.getAttribute("data-key")).filter(Boolean),
  );
  const candidates = ["delta", "epsilon", "zeta", "eta", "theta"];

  for (const candidate of candidates) {
    if (!existingKeys.has(candidate)) {
      return candidate;
    }
  }

  return `item-${existingKeys.size + 1}`;
}

function moveListItem(item, direction) {
  if (!item || !item.parentElement) {
    return;
  }

  if (direction < 0 && item.previousElementSibling) {
    item.parentElement.insertBefore(item, item.previousElementSibling);
    return;
  }

  if (direction > 0 && item.nextElementSibling) {
    item.parentElement.insertBefore(item.nextElementSibling, item);
  }
}

function setTestPreviewEditMode(container, isEnabled) {
  getEditableTargets(container).forEach((target) => {
    if (isEnabled) {
      target.dataset.editorEditing = "true";
      target.setAttribute("contenteditable", "plaintext-only");
      target.setAttribute("spellcheck", "false");
      return;
    }

    if (target.dataset.editorEditing === "true" || target.hasAttribute("contenteditable")) {
      finishInlineEdit(target);
      return;
    }

    clearInlineEditState(target);
  });
}

function createDraftVdom(container) {
  const snapshot = container.cloneNode(true);

  getEditableTargets(snapshot).forEach((target) => {
    clearInlineEditState(target);
  });

  return domToVdom(snapshot);
}

function getEditableTargets(container) {
  return Array.from(container.querySelectorAll(EDITABLE_FIELD_SELECTOR));
}

function clearInlineEditState(target) {
  target.removeAttribute("contenteditable");
  target.removeAttribute("spellcheck");
  delete target.dataset.editorEditing;
}

function syncEditModeButton(button, isEnabled) {
  button.textContent = isEnabled ? "편집 중" : "편집 모드";
  button.classList.toggle("action-button--primary", isEnabled);
  button.setAttribute("aria-pressed", String(isEnabled));
}

function syncHistoryInspection(elements, inspectedIndex) {
  if (Number.isInteger(inspectedIndex)) {
    elements.historyTrack.dataset.inspectingIndex = String(inspectedIndex);
    return;
  }

  delete elements.historyTrack.dataset.inspectingIndex;
}

function requiredElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required element #${id} was not found.`);
  }

  return element;
}
