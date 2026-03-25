/**
 * 역할:
 * - 앱의 시작점입니다.
 * - actualVdom(실제 영역 상태)과 draftVdom(테스트 영역 상태)을 나눠서 관리합니다.
 * - Patch / Undo / Redo / 편집 모드 흐름을 한 파일에서 따라갈 수 있게 정리했습니다.
 *
 * 이 파일을 읽어야 하는 경우:
 * - 이 프로젝트가 어떤 순서로 동작하는지 전체 흐름부터 보고 싶을 때
 * - "왜 이제는 테스트 DOM을 다시 읽지 않고 draftVdom을 기준으로 비교하는지" 이해하고 싶을 때
 *
 * 관련 파일:
 * - ./state/store.js: actualVdom / draftVdom / history를 저장합니다.
 * - ./core/vdom.js: 초기 DOM -> VDOM 변환과 VDOM 렌더링을 담당합니다.
 * - ./core/diff.js: actualVdom 과 draftVdom 의 차이를 계산합니다.
 * - ./core/patch.js: 실제 DOM에는 필요한 부분만 반영합니다.
 * - ./ui/appUi.js: 화면 렌더링과 상태 표시를 담당합니다.
 */

import { diffTrees } from "./core/diff.js";
import { patchDom } from "./core/patch.js";
import { domToVdom, getNodeKey, sanitizeHtml } from "./core/vdom.js";
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

const EDITABLE_SELECTOR = '[data-role="title"], [data-role="description"], .sample-value';
const TEXT_FALLBACK = "내용 없음";
const THEME_CLASSES = ["theme-blue", "theme-emerald", "theme-amber"];
const ITEM_KEY_CANDIDATES = ["delta", "epsilon", "zeta", "eta", "theta"];

document.addEventListener("DOMContentLoaded", () => {
  const elements = getElements();
  const initialVdom = createInitialVdom(elements);
  const store = createStore(initialVdom);
  const observer = createDomObserver(elements.actualPreview);
  const uiState = {
    isDirty: false,
    isEditModeEnabled: false,
    inspectedHistoryIndex: null,
  };

  bindToolbarEvents(elements, store, observer, uiState);
  bindTestPanelEvents(elements, store, uiState);

  observer.flush();
  syncEditModeButton(elements.editModeButton, uiState.isEditModeEnabled);
  renderTestDraft(elements, store, uiState.isEditModeEnabled);
  renderLiveState(elements, store, uiState);
});

function bindToolbarEvents(elements, store, observer, uiState) {
  elements.editModeButton.addEventListener("click", () => {
    uiState.isEditModeEnabled = !uiState.isEditModeEnabled;
    syncEditModeButton(elements.editModeButton, uiState.isEditModeEnabled);
    renderTestDraft(elements, store, uiState.isEditModeEnabled);
  });

  elements.patchButton.addEventListener("click", () => {
    const previousVdom = store.getCurrentVdom();
    const nextVdom = store.getDraftVdom();
    const changes = diffTrees(previousVdom, nextVdom);

    if (changes.length === 0) {
      store.inspect([], 0);
      uiState.isDirty = false;
      clearHistoryInspection(elements, uiState);
      renderLiveState(elements, store, uiState, []);
      return;
    }

    patchDom(elements.actualPreview, previousVdom, nextVdom);
    const mutationCount = observer.flush();

    store.commitDraft(changes, mutationCount);
    renderActualSource(elements, nextVdom);
    renderTestDraft(elements, store, uiState.isEditModeEnabled);

    uiState.isDirty = false;
    clearHistoryInspection(elements, uiState);
    renderStatus(elements, store, uiState.isDirty, createHistoryClickHandler(elements, store, uiState), changes);
    renderChangeList(elements, changes);
    renderHtmlComparison(elements, {
      beforeVdom: previousVdom,
      afterVdom: nextVdom,
      beforeLabel: "Patch 전 HTML",
      afterLabel: "Patch 후 HTML",
    });
  });

  elements.undoButton.addEventListener("click", () => {
    const currentVdom = store.getCurrentVdom();
    const previousVdom = store.undo();

    if (!previousVdom) {
      return;
    }

    patchDom(elements.actualPreview, currentVdom, previousVdom);
    const changes = diffTrees(currentVdom, previousVdom);
    const mutationCount = observer.flush();

    store.inspect(changes, mutationCount);
    renderActualSource(elements, previousVdom);
    renderTestDraft(elements, store, uiState.isEditModeEnabled);

    uiState.isDirty = false;
    clearHistoryInspection(elements, uiState);
    renderStatus(elements, store, uiState.isDirty, createHistoryClickHandler(elements, store, uiState), changes);
    renderChangeList(elements, changes);
    renderHtmlComparison(elements, {
      beforeVdom: currentVdom,
      afterVdom: previousVdom,
      beforeLabel: "Undo 전 HTML",
      afterLabel: "Undo 결과 HTML",
    });
  });

  elements.redoButton.addEventListener("click", () => {
    const currentVdom = store.getCurrentVdom();
    const nextVdom = store.redo();

    if (!nextVdom) {
      return;
    }

    patchDom(elements.actualPreview, currentVdom, nextVdom);
    const changes = diffTrees(currentVdom, nextVdom);
    const mutationCount = observer.flush();

    store.inspect(changes, mutationCount);
    renderActualSource(elements, nextVdom);
    renderTestDraft(elements, store, uiState.isEditModeEnabled);

    uiState.isDirty = false;
    clearHistoryInspection(elements, uiState);
    renderStatus(elements, store, uiState.isDirty, createHistoryClickHandler(elements, store, uiState), changes);
    renderChangeList(elements, changes);
    renderHtmlComparison(elements, {
      beforeVdom: currentVdom,
      afterVdom: nextVdom,
      beforeLabel: "Redo 전 HTML",
      afterLabel: "Redo 결과 HTML",
    });
  });
}

function bindTestPanelEvents(elements, store, uiState) {
  elements.testPreview.addEventListener("click", (event) => {
    const control = event.target.closest("[data-editor-control][data-action]");

    if (!control) {
      return;
    }

    event.preventDefault();

    updateDraftVdom(store, (draftVdom) => {
      runDraftAction(draftVdom, control.dataset.action, control.dataset.key);
    });

    syncDraftChange(elements, store, uiState, true);
  });

  elements.testPreview.addEventListener("input", (event) => {
    if (!uiState.isEditModeEnabled) {
      return;
    }

    const target = event.target.closest(EDITABLE_SELECTOR);

    if (!target) {
      return;
    }

    updateDraftTextFromTarget(store, target, false);
    syncDraftChange(elements, store, uiState, false);
  });

  elements.testPreview.addEventListener(
    "focusout",
    (event) => {
      if (!uiState.isEditModeEnabled) {
        return;
      }

      const target = event.target.closest(EDITABLE_SELECTOR);

      if (!target) {
        return;
      }

      target.textContent = normalizeText(target.textContent);
      updateDraftTextFromTarget(store, target, true);
      syncDraftChange(elements, store, uiState, true);
    },
    true,
  );
}

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

function renderTestDraft(elements, store, isEditModeEnabled) {
  renderTestPanel(elements, store.getDraftVdom());
  decorateTestPreview(elements, isEditModeEnabled);
}

function renderLiveState(elements, store, uiState, liveChanges = null) {
  const currentVdom = store.getCurrentVdom();
  const draftVdom = store.getDraftVdom();
  const pendingChanges = liveChanges ?? diffTrees(currentVdom, draftVdom);
  const displayChanges = uiState.isDirty ? pendingChanges : store.getLastChanges();

  renderStatus(
    elements,
    store,
    uiState.isDirty,
    createHistoryClickHandler(elements, store, uiState),
    displayChanges,
  );
  renderChangeList(elements, displayChanges);
  renderHtmlComparison(elements, {
    beforeVdom: currentVdom,
    afterVdom: draftVdom,
    beforeLabel: "현재 Actual HTML",
    afterLabel: "현재 Test HTML",
  });
}

function syncDraftChange(elements, store, uiState, shouldRerenderTest) {
  const liveChanges = diffTrees(store.getCurrentVdom(), store.getDraftVdom());

  uiState.isDirty = liveChanges.length > 0;
  clearHistoryInspection(elements, uiState);

  if (shouldRerenderTest) {
    renderTestDraft(elements, store, uiState.isEditModeEnabled);
  }

  renderLiveState(elements, store, uiState, liveChanges);
}

function createHistoryClickHandler(elements, store, uiState) {
  return (index) => {
    const snapshot = store.getSnapshotAt(index);

    if (!snapshot) {
      return;
    }

    const currentIndex = store.getHistoryMeta().index;

    if (index === currentIndex) {
      clearHistoryInspection(elements, uiState);
      renderLiveState(elements, store, uiState);
      return;
    }

    uiState.inspectedHistoryIndex = index;
    syncHistoryInspection(elements, uiState.inspectedHistoryIndex);
    renderStatus(elements, store, uiState.isDirty, createHistoryClickHandler(elements, store, uiState), snapshot.changes);
    renderChangeList(elements, snapshot.changes);
    renderHtmlComparison(elements, {
      beforeVdom: snapshot.previousVdom,
      afterVdom: snapshot.vdom,
      beforeLabel: `[${index + 1}] 이전 HTML`,
      afterLabel: `[${index + 1}] 변경 후 HTML`,
    });
  };
}

function updateDraftVdom(store, updater) {
  const nextDraft = store.getDraftVdom();
  updater(nextDraft);
  store.setDraftVdom(nextDraft);
}

function updateDraftTextFromTarget(store, target, useNormalizedText) {
  const nextDraft = store.getDraftVdom();
  const nextText = useNormalizedText ? normalizeText(target.textContent) : target.textContent ?? "";
  const role = target.dataset.role;

  if (role === "title" || role === "description") {
    setNodeText(findNodeByRole(nextDraft, role), nextText || TEXT_FALLBACK);
    store.setDraftVdom(nextDraft);
    return;
  }

  if (target.classList.contains("sample-value")) {
    const itemKey = target.closest("li")?.dataset.key ?? "";
    const itemNode = findListItemByKey(nextDraft, itemKey);
    const valueNode = findNodeByClass(itemNode, "sample-value");

    setNodeText(valueNode, nextText || TEXT_FALLBACK);
    store.setDraftVdom(nextDraft);
  }
}

function runDraftAction(draftVdom, action, itemKey = "") {
  switch (action) {
    case "toggle-color":
      toggleDraftTheme(draftVdom);
      return;
    case "toggle-replace":
      toggleDraftReplaceTarget(draftVdom);
      return;
    case "add-item":
      addDraftListItem(draftVdom);
      return;
    case "delete-item":
      deleteDraftListItem(draftVdom, itemKey);
      return;
    case "move-up":
      moveDraftListItem(draftVdom, itemKey, -1);
      return;
    case "move-down":
      moveDraftListItem(draftVdom, itemKey, 1);
      return;
    default:
  }
}

function decorateTestPreview(elements, isEditModeEnabled) {
  const root = elements.testPreview.firstElementChild;

  if (!root) {
    return;
  }

  root.querySelectorAll("[data-editor-control]").forEach((node) => node.remove());
  setEditableFields(elements.testPreview, isEditModeEnabled);

  if (!isEditModeEnabled) {
    return;
  }

  const list = root.querySelector(".sample-list");
  const row = root.querySelector(".sample-row");

  if (row) {
    row.append(
      createControlGroup(
        [
          createControlButton("색상 변경", "toggle-color"),
          createControlButton("태그 교체", "toggle-replace"),
        ],
        "editor-controls--row",
      ),
    );
  }

  if (list) {
    Array.from(list.children).forEach((item) => {
      const itemKey = item.getAttribute("data-key") ?? "";

      item.append(
        createControlGroup(
          [
            createControlButton("삭제", "delete-item", itemKey),
            createControlButton("위로", "move-up", itemKey),
            createControlButton("아래로", "move-down", itemKey),
          ],
          "editor-controls--item",
        ),
      );
    });

    list.after(createControlGroup([createControlButton("항목 추가", "add-item")], "editor-controls--footer"));
  }
}

function createControlGroup(buttons, extraClass = "") {
  const group = document.createElement("div");
  group.className = `editor-controls ${extraClass}`.trim();
  group.dataset.editorControl = "true";
  group.append(...buttons);
  return group;
}

function createControlButton(label, action, key = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "editor-action";
  button.dataset.editorControl = "true";
  button.dataset.action = action;

  if (key) {
    button.dataset.key = key;
  }

  button.textContent = label;
  return button;
}

function setEditableFields(container, isEnabled) {
  getEditableTargets(container).forEach((target) => {
    if (isEnabled) {
      target.setAttribute("contenteditable", "plaintext-only");
      target.setAttribute("spellcheck", "false");
      return;
    }

    target.removeAttribute("contenteditable");
    target.removeAttribute("spellcheck");
  });
}

function getEditableTargets(container) {
  return Array.from(container.querySelectorAll(EDITABLE_SELECTOR));
}

function normalizeText(text) {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  return normalized || TEXT_FALLBACK;
}

function toggleDraftTheme(vdom) {
  const root = getSampleRoot(vdom);
  const themeTag = findNodeByRole(vdom, "theme-tag");

  if (!root) {
    return;
  }

  const classNames = getClassNames(root);
  const currentTheme = THEME_CLASSES.find((theme) => classNames.includes(theme)) ?? THEME_CLASSES[0];
  const nextTheme = THEME_CLASSES[(THEME_CLASSES.indexOf(currentTheme) + 1) % THEME_CLASSES.length];
  const nextClasses = classNames
    .filter((className) => !THEME_CLASSES.includes(className))
    .concat(nextTheme);

  root.attrs.class = nextClasses.join(" ");
  setNodeText(themeTag, nextTheme);
}

function toggleDraftReplaceTarget(vdom) {
  const target = findNodeByRole(vdom, "replace-target");

  if (!target) {
    return;
  }

  if (target.tagName === "button") {
    target.tagName = "a";
    target.attrs = {
      href: "#",
      class: "sample-button sample-button--link",
      "data-role": "replace-target",
    };
    setNodeText(target, "link");
    return;
  }

  target.tagName = "button";
  target.attrs = {
    type: "button",
    class: "sample-button",
    "data-role": "replace-target",
  };
  setNodeText(target, "button");
}

function addDraftListItem(vdom) {
  const list = findListNode(vdom);

  if (!list) {
    return;
  }

  list.children.push(createListItemVdom(getNextItemKey(list)));
}

function deleteDraftListItem(vdom, itemKey) {
  const list = findListNode(vdom);

  if (!list) {
    return;
  }

  list.children = list.children.filter((child) => getNodeKey(child) !== itemKey);
}

function moveDraftListItem(vdom, itemKey, direction) {
  const list = findListNode(vdom);

  if (!list) {
    return;
  }

  const index = list.children.findIndex((child) => getNodeKey(child) === itemKey);

  if (index === -1) {
    return;
  }

  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= list.children.length) {
    return;
  }

  const [movedItem] = list.children.splice(index, 1);
  list.children.splice(nextIndex, 0, movedItem);
}

function createListItemVdom(itemKey) {
  return {
    type: "element",
    tagName: "li",
    attrs: { "data-key": itemKey },
    children: [
      {
        type: "element",
        tagName: "strong",
        attrs: { class: "sample-key" },
        children: [{ type: "text", value: itemKey }],
      },
      {
        type: "element",
        tagName: "span",
        attrs: { class: "sample-value" },
        children: [{ type: "text", value: "새 항목" }],
      },
    ],
  };
}

function getNextItemKey(listNode) {
  const existingKeys = new Set(listNode.children.map((child) => getNodeKey(child)).filter(Boolean));

  for (const itemKey of ITEM_KEY_CANDIDATES) {
    if (!existingKeys.has(itemKey)) {
      return itemKey;
    }
  }

  return `item-${existingKeys.size + 1}`;
}

function getSampleRoot(vdom) {
  return vdom.children?.[0] ?? null;
}

function findListNode(vdom) {
  return findNodeByClass(vdom, "sample-list");
}

function findListItemByKey(vdom, itemKey) {
  return findNode(vdom, (node) => getNodeKey(node) === itemKey);
}

function findNodeByRole(vdom, role) {
  return findNode(vdom, (node) => node.attrs?.["data-role"] === role);
}

function findNodeByClass(vdom, className) {
  return findNode(vdom, (node) => getClassNames(node).includes(className));
}

function findNode(node, predicate) {
  if (!node) {
    return null;
  }

  if (predicate(node)) {
    return node;
  }

  for (const child of node.children ?? []) {
    const match = findNode(child, predicate);

    if (match) {
      return match;
    }
  }

  return null;
}

function getClassNames(node) {
  return (node?.attrs?.class ?? "").split(/\s+/).filter(Boolean);
}

function setNodeText(node, text) {
  if (!node) {
    return;
  }

  node.children = [{ type: "text", value: text }];
}

function syncEditModeButton(button, isEnabled) {
  button.textContent = isEnabled ? "편집 중" : "편집 모드";
  button.classList.toggle("action-button--edit-active", isEnabled);
  button.setAttribute("aria-pressed", String(isEnabled));
}

function clearHistoryInspection(elements, uiState) {
  uiState.inspectedHistoryIndex = null;
  syncHistoryInspection(elements, uiState.inspectedHistoryIndex);
}

function syncHistoryInspection(elements, inspectedIndex) {
  if (Number.isInteger(inspectedIndex)) {
    elements.historyTrack.dataset.inspectingIndex = String(inspectedIndex);
    return;
  }

  delete elements.historyTrack.dataset.inspectingIndex;
}
