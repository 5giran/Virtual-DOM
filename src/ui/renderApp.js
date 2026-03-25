import { CHANGE_TYPES } from "../core/diff/changeTypes.js";
import { formatPath, summarizeChanges } from "../core/diff/diffTrees.js";
import { renderVdom } from "../core/vdom/createDomFromVdom.js";
import { serializeVdom } from "../core/vdom/serializeVdom.js";
import { sanitizeHtml } from "../utils/html.js";

export function renderActualPreview(elements, vdom) {
  renderVdom(elements.actualPreview, vdom);
}

export function renderActualSource(elements, vdom) {
  elements.actualSource.textContent = serializeVdom(vdom);
}

export function renderTestPanel(elements, vdom) {
  renderVdom(elements.testPreview, vdom);
  elements.testSource.value = serializeVdom(vdom);
}

export function renderTestPreviewFromSource(elements) {
  const sanitized = sanitizeHtml(elements.testSource.value);
  elements.testPreview.innerHTML = sanitized;
  return sanitized;
}

export function renderStatus(elements, store, isDirty) {
  const changes = store.getLastChanges();
  const summary = summarizeChanges(changes);
  const historyMeta = store.getHistoryMeta();

  elements.changeCount.textContent = String(summary.total);
  elements.mutationCount.textContent = String(store.getLastMutationCount());
  elements.historyPosition.textContent = `${historyMeta.index + 1} / ${historyMeta.size}`;
  elements.dirtyIndicator.textContent = isDirty ? "수정 중" : "동기화됨";

  elements.undoButton.disabled = !store.canUndo();
  elements.redoButton.disabled = !store.canRedo();
}

export function renderChangeList(elements, changes) {
  const items =
    changes.length === 0
      ? ["변경이 없습니다. 테스트 영역을 수정한 뒤 Patch 버튼을 눌러 보세요."]
      : changes.map((change) => describeChange(change));

  elements.changeList.replaceChildren(
    ...items.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    }),
  );
}

function describeChange(change) {
  const path = formatPath(change.path);

  switch (change.type) {
    case CHANGE_TYPES.CREATE:
      return `[CREATE] ${path} 위치에 새 노드가 추가됩니다.`;
    case CHANGE_TYPES.REMOVE:
      return `[REMOVE] ${path} 위치의 노드가 제거됩니다.`;
    case CHANGE_TYPES.REPLACE:
      return `[REPLACE] ${path} 위치의 노드 타입 또는 태그가 바뀝니다.`;
    case CHANGE_TYPES.UPDATE_TEXT:
      return `[TEXT] ${path} 위치의 텍스트가 "${change.prevValue}" -> "${change.nextValue}" 로 바뀝니다.`;
    case CHANGE_TYPES.SET_ATTRIBUTE:
      return `[ATTR+] ${path} 위치의 ${change.attribute} 속성이 "${change.nextValue}" 로 갱신됩니다.`;
    case CHANGE_TYPES.REMOVE_ATTRIBUTE:
      return `[ATTR-] ${path} 위치의 ${change.attribute} 속성이 제거됩니다.`;
    case CHANGE_TYPES.MOVE_CHILD:
      return `[MOVE] ${path} 하위의 key=${change.key} 노드가 ${change.from} -> ${change.to} 로 이동합니다.`;
    default:
      return `[UNKNOWN] ${path}`;
  }
}
