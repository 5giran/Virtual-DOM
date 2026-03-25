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
import { domToVdom, getNodeKey, htmlToVdom, sanitizeHtml } from "./core/vdom.js";
import {
  createDomObserver,
  getElements,
  renderActualPreview,
  renderActualSource,
  renderChangeList,
  renderDraftSource,
  renderHtmlComparison,
  renderHtmlEditorStatus,
  renderStatus,
  renderTestPanel,
} from "./ui/appUi.js";
import { createStore } from "./state/store.js";
import { sampleMarkup } from "./sampleMarkup.js";

const EDITABLE_SELECTOR = '[data-role="title"], [data-role="description"], .sample-value';
const TEXT_FALLBACK = "내용 없음";
const THEME_CLASSES = ["theme-blue", "theme-emerald", "theme-amber"];
const ITEM_KEY_CANDIDATES = ["delta", "epsilon", "zeta", "eta", "theta"];
const HTML_VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

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
  syncHtmlEditorValidation(elements, { shouldShowReady: true });
});

function bindToolbarEvents(elements, store, observer, uiState) {
  // 상단 버튼(Patch / Undo / Redo / 편집 모드)의 동작을 한곳에서 묶습니다.
  elements.htmlEditor.addEventListener("input", () => {
    syncHtmlEditorValidation(elements, { shouldShowReady: true });
  });

  elements.editModeButton.addEventListener("click", () => {
    uiState.isEditModeEnabled = !uiState.isEditModeEnabled;
    syncEditModeButton(elements.editModeButton, uiState.isEditModeEnabled);
    renderTestDraft(elements, store, uiState.isEditModeEnabled);
  });

  elements.patchButton.addEventListener("click", () => {
    const previousVdom = store.getCurrentVdom();
    const nextVdom = store.getDraftVdom();
    const didCommit = commitPatchedVdom(elements, store, observer, uiState, {
      beforeVdom: previousVdom,
      afterVdom: nextVdom,
      beforeLabel: "Patch 전 HTML",
      afterLabel: "Patch 후 HTML",
    });

    if (didCommit) {
      renderHtmlEditorStatus(elements, "Patch 완료", "success");
    }
  });

  elements.htmlApplyButton.addEventListener("click", () => {
    const previousVdom = store.getCurrentVdom();
    const nextVdom = htmlToVdom(elements.htmlEditor.value);

    store.setDraftVdom(nextVdom);
    const didCommit = commitPatchedVdom(elements, store, observer, uiState, {
      beforeVdom: previousVdom,
      afterVdom: nextVdom,
      beforeLabel: "HTML 적용 전",
      afterLabel: "HTML 적용 후",
    });

    if (didCommit) {
      renderHtmlEditorStatus(elements, "HTML 코드가 실제 DOM에 반영됨", "success");
    }
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
    renderDraftSource(elements, previousVdom);
    renderHtmlComparison(elements, {
      beforeVdom: currentVdom,
      afterVdom: previousVdom,
      beforeLabel: "Undo 전 HTML",
      afterLabel: "Undo 결과 HTML",
    });
    renderHtmlEditorStatus(elements, "Undo로 HTML 편집기가 동기화됨", "idle");
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
    renderDraftSource(elements, nextVdom);
    renderHtmlComparison(elements, {
      beforeVdom: currentVdom,
      afterVdom: nextVdom,
      beforeLabel: "Redo 전 HTML",
      afterLabel: "Redo 결과 HTML",
    });
    renderHtmlEditorStatus(elements, "Redo로 HTML 편집기가 동기화됨", "idle");
  });
}

function bindTestPanelEvents(elements, store, uiState) {
  // 테스트 영역 안에서 일어나는 클릭/입력 이벤트를 draftVdom 변경으로 연결합니다.
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
  // 처음 한 번만 샘플 HTML을 실제 DOM에 넣고 초기 VDOM을 만듭니다.
  elements.actualPreview.innerHTML = sanitizeHtml(sampleMarkup);
  const initialVdom = domToVdom(elements.actualPreview);

  renderActualPreview(elements, initialVdom);
  renderActualSource(elements, initialVdom);
  renderTestPanel(elements, initialVdom);
  renderDraftSource(elements, initialVdom);
  renderHtmlComparison(elements, {
    beforeVdom: initialVdom,
    afterVdom: initialVdom,
    beforeLabel: "현재 Actual HTML",
    afterLabel: "현재 Test HTML",
  });

  return initialVdom;
}

function renderTestDraft(elements, store, isEditModeEnabled) {
  // 현재 draftVdom 상태를 테스트 영역에 다시 그립니다.
  renderTestPanel(elements, store.getDraftVdom());
  decorateTestPreview(elements, isEditModeEnabled);
}

function renderLiveState(elements, store, uiState, liveChanges = null) {
  // 실제 상태와 테스트 상태를 비교해서 로그 / HTML 비교 / 메트릭을 갱신합니다.
  const currentVdom = store.getCurrentVdom();
  const draftVdom = store.getDraftVdom();
  const pendingChanges = liveChanges ?? diffTrees(currentVdom, draftVdom);
  const displayChanges = uiState.isDirty ? pendingChanges : store.getLastChanges();

  renderDraftSource(elements, draftVdom);
  syncHtmlEditorValidation(elements);
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

function commitPatchedVdom(elements, store, observer, uiState, comparisonOptions) {
  // draftVdom을 실제 DOM에 반영하고, history / 로그 / HTML 패널을 한 번에 갱신합니다.
  const previousVdom = comparisonOptions.beforeVdom;
  const nextVdom = comparisonOptions.afterVdom;
  const changes = diffTrees(previousVdom, nextVdom);

  if (changes.length === 0) {
    store.inspect([], 0);
    uiState.isDirty = false;
    clearHistoryInspection(elements, uiState);
    renderLiveState(elements, store, uiState, []);
    renderHtmlEditorStatus(elements, "변경 사항이 없음", "idle");
    return false;
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
  renderDraftSource(elements, nextVdom);
  renderHtmlComparison(elements, comparisonOptions);
  return true;
}

function syncDraftChange(elements, store, uiState, shouldRerenderTest) {
  // draftVdom이 바뀌었을 때 "수정 중" 상태와 미리보기 화면을 함께 갱신합니다.
  const liveChanges = diffTrees(store.getCurrentVdom(), store.getDraftVdom());

  uiState.isDirty = liveChanges.length > 0;
  clearHistoryInspection(elements, uiState);

  if (shouldRerenderTest) {
    renderTestDraft(elements, store, uiState.isEditModeEnabled);
  }

  renderLiveState(elements, store, uiState, liveChanges);
}

function createHistoryClickHandler(elements, store, uiState) {
  // history 점을 클릭했을 때 해당 시점의 diff와 HTML 비교를 보여줍니다.
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
  // draftVdom을 꺼내 수정한 뒤 다시 store에 넣는 공통 헬퍼입니다.
  const nextDraft = store.getDraftVdom();
  updater(nextDraft);
  store.setDraftVdom(nextDraft);
}

function updateDraftTextFromTarget(store, target, useNormalizedText) {
  // 사용자가 화면에서 수정한 텍스트를 draftVdom 안의 맞는 노드에 반영합니다.
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
  // 버튼 종류에 따라 draftVdom 변경 함수를 골라 실행합니다.
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
  // 테스트 영역에 편집 버튼을 붙이고, 필요한 곳만 수정 가능하게 만듭니다.
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
  // 여러 편집 버튼을 한 묶음 UI로 만드는 작은 helper입니다.
  const group = document.createElement("div");
  group.className = `editor-controls ${extraClass}`.trim();
  group.dataset.editorControl = "true";
  group.append(...buttons);
  return group;
}

function createControlButton(label, action, key = "") {
  // 편집 버튼 하나를 만들고 어떤 액션인지 data 속성으로 기록합니다.
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
  // 편집 모드일 때만 제목/설명/항목 텍스트를 직접 수정할 수 있게 합니다.
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
  // contenteditable을 붙일 대상 노드들을 한 번에 찾습니다.
  return Array.from(container.querySelectorAll(EDITABLE_SELECTOR));
}

function normalizeText(text) {
  // 과한 공백을 정리해서 비교하기 쉬운 텍스트로 맞춥니다.
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  return normalized || TEXT_FALLBACK;
}

function toggleDraftTheme(vdom) {
  // sample-shell의 theme 클래스를 순서대로 바꿔 색상 변경 케이스를 만듭니다.
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
  // button <-> a 태그를 바꿔 노드 교체(replace) 케이스를 만듭니다.
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
  // 리스트 끝에 새 항목을 추가해서 create 케이스를 만듭니다.
  const list = findListNode(vdom);

  if (!list) {
    return;
  }

  list.children.push(createListItemVdom(getNextItemKey(list)));
}

function deleteDraftListItem(vdom, itemKey) {
  // key로 항목을 찾아 리스트에서 제거합니다.
  const list = findListNode(vdom);

  if (!list) {
    return;
  }

  list.children = list.children.filter((child) => getNodeKey(child) !== itemKey);
}

function moveDraftListItem(vdom, itemKey, direction) {
  // 같은 항목을 위/아래로 옮겨 순서 변경 케이스를 만듭니다.
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
  // 새로 추가할 리스트 항목의 기본 VDOM 모양입니다.
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
  // 이미 쓰지 않은 key를 골라 새 리스트 항목에 붙입니다.
  const existingKeys = new Set(listNode.children.map((child) => getNodeKey(child)).filter(Boolean));

  for (const itemKey of ITEM_KEY_CANDIDATES) {
    if (!existingKeys.has(itemKey)) {
      return itemKey;
    }
  }

  return `item-${existingKeys.size + 1}`;
}

function getSampleRoot(vdom) {
  // 데모 화면의 최상위 section 노드를 꺼냅니다.
  return vdom.children?.[0] ?? null;
}

function findListNode(vdom) {
  // sample-list 클래스를 가진 ul 노드를 찾습니다.
  return findNodeByClass(vdom, "sample-list");
}

function findListItemByKey(vdom, itemKey) {
  // data-key 값으로 특정 li 항목을 찾습니다.
  return findNode(vdom, (node) => getNodeKey(node) === itemKey);
}

function findNodeByRole(vdom, role) {
  // data-role 값으로 제목, 설명 같은 고정 역할 노드를 찾습니다.
  return findNode(vdom, (node) => node.attrs?.["data-role"] === role);
}

function findNodeByClass(vdom, className) {
  // class 이름으로 원하는 노드를 찾습니다.
  return findNode(vdom, (node) => getClassNames(node).includes(className));
}

function findNode(node, predicate) {
  // VDOM 트리를 깊이 우선으로 돌면서 조건에 맞는 첫 노드를 찾습니다.
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
  // class 문자열을 ["a", "b"] 같은 배열로 바꿉니다.
  return (node?.attrs?.class ?? "").split(/\s+/).filter(Boolean);
}

function setNodeText(node, text) {
  // 노드 안 텍스트를 새 값 하나로 교체합니다.
  if (!node) {
    return;
  }

  node.children = [{ type: "text", value: text }];
}

function syncEditModeButton(button, isEnabled) {
  // 편집 모드 버튼의 문구와 활성 상태를 맞춥니다.
  button.textContent = isEnabled ? "편집 중" : "편집 모드";
  button.classList.toggle("action-button--edit-active", isEnabled);
  button.setAttribute("aria-pressed", String(isEnabled));
}

function clearHistoryInspection(elements, uiState) {
  // history 미리보기 모드를 해제하고 현재 상태 보기로 돌아갑니다.
  uiState.inspectedHistoryIndex = null;
  syncHistoryInspection(elements, uiState.inspectedHistoryIndex);
}

function syncHistoryInspection(elements, inspectedIndex) {
  // history 트랙에 "지금 어떤 시점을 보고 있는지" 표시합니다.
  if (Number.isInteger(inspectedIndex)) {
    elements.historyTrack.dataset.inspectingIndex = String(inspectedIndex);
    return;
  }

  delete elements.historyTrack.dataset.inspectingIndex;
}

function syncHtmlEditorValidation(elements, { shouldShowReady = false } = {}) {
  // HTML 편집기 내용을 검사해서 적용 버튼 활성화와 상태 문구를 맞춥니다.
  const validation = validateHtmlEditorInput(elements.htmlEditor.value);
  const previousState = elements.htmlEditorStatus.dataset.state ?? "idle";

  elements.htmlApplyButton.disabled = !validation.isValid;
  elements.htmlEditor.dataset.invalid = validation.isValid ? "false" : "true";
  elements.htmlEditor.setAttribute("aria-invalid", String(!validation.isValid));

  if (!validation.isValid) {
    renderHtmlEditorStatus(elements, validation.message, "error");
    return validation;
  }

  if (shouldShowReady || previousState === "error") {
    renderHtmlEditorStatus(elements, "HTML 적용 가능", "idle");
  }

  return validation;
}

function validateHtmlEditorInput(input) {
  // VS Code급 문법 검사 대신, patch 전에 막아야 하는 명백한 구조 문제를 빠르게 검사합니다.
  const source = (input ?? "").trim();

  if (!source) {
    return {
      isValid: false,
      message: "HTML이 비어 있어서 적용할 수 없음",
    };
  }

  const structureValidation = validateHtmlTagStructure(source);

  if (!structureValidation.isValid) {
    return structureValidation;
  }

  const sanitized = sanitizeHtml(source);

  if (!sanitized) {
    return {
      isValid: false,
      message: "sanitize 후 남는 HTML이 없음",
    };
  }

  const duplicateKeys = findDuplicateDataKeys(sanitized);

  if (duplicateKeys.length > 0) {
    return {
      isValid: false,
      message: `중복 data-key 감지: ${duplicateKeys.join(", ")}`,
    };
  }

  return {
    isValid: true,
    message: "HTML 적용 가능",
  };
}

function validateHtmlTagStructure(source) {
  // 열린 태그/닫는 태그의 기본 짝이 맞는지 스택으로 확인합니다.
  const tagPattern = /<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;
  const stack = [];

  for (const match of source.matchAll(tagPattern)) {
    const [fullMatch, rawTagName] = match;
    const tagName = rawTagName.toLowerCase();
    const isClosing = fullMatch.startsWith("</");
    const isSelfClosing = fullMatch.endsWith("/>") || HTML_VOID_TAGS.has(tagName);

    if (isClosing) {
      const expectedTag = stack.pop();

      if (expectedTag !== tagName) {
        return {
          isValid: false,
          message: `태그 짝이 맞지 않음: </${tagName}>`,
        };
      }

      continue;
    }

    if (!isSelfClosing) {
      stack.push(tagName);
    }
  }

  if (stack.length > 0) {
    return {
      isValid: false,
      message: `닫히지 않은 태그가 있음: <${stack[stack.length - 1]}>`,
    };
  }

  return {
    isValid: true,
    message: "태그 구조 정상",
  };
}

function findDuplicateDataKeys(html) {
  // 같은 data-key가 여러 번 나오면 keyed diff가 불안정해지므로 patch 전에 차단합니다.
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  const counts = new Map();

  wrapper.querySelectorAll("[data-key]").forEach((node) => {
    const key = node.getAttribute("data-key") ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}
