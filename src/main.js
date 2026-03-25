import { diffTrees } from "./core/diff/diffTrees.js";
import { patchDom } from "./core/patch/reconcileDom.js";
import { domToVdom } from "./core/vdom/domToVdom.js";
import { renderActualPreview, renderActualSource, renderChangeList, renderStatus, renderTestPanel, renderTestPreviewFromSource } from "./ui/renderApp.js";
import { createStore } from "./state/createStore.js";
import { getElements } from "./ui/elements.js";
import { createDomObserver } from "./ui/observeDomChanges.js";
import { sampleMarkup } from "./samples/sampleMarkup.js";
import { sanitizeHtml } from "./utils/html.js";

document.addEventListener("DOMContentLoaded", () => {
  const elements = getElements();
  const initialVdom = createInitialVdom(elements);
  const store = createStore(initialVdom);
  const observer = createDomObserver(elements.actualPreview);
  let isDirty = false;

  observer.flush();
  renderStatus(elements, store, isDirty);
  renderChangeList(elements, store.getLastChanges());

  elements.testSource.addEventListener("input", () => {
    renderTestPreviewFromSource(elements);
    isDirty = true;
    renderStatus(elements, store, isDirty);
  });

  elements.patchButton.addEventListener("click", () => {
    const nextVdom = buildVdomFromEditor(elements);
    const previousVdom = store.getCurrentVdom();
    const changes = diffTrees(previousVdom, nextVdom);

    if (changes.length === 0) {
      store.inspect([], 0);
      isDirty = false;
      renderStatus(elements, store, isDirty);
      renderChangeList(elements, []);
      return;
    }

    patchDom(elements.actualPreview, previousVdom, nextVdom);
    const mutationCount = observer.flush();

    store.commit(nextVdom, changes, mutationCount);
    renderActualSource(elements, nextVdom);
    renderTestPanel(elements, nextVdom);

    isDirty = false;
    renderStatus(elements, store, isDirty);
    renderChangeList(elements, changes);
  });

  elements.undoButton.addEventListener("click", () => {
    const previousState = store.undo();

    if (!previousState) {
      return;
    }

    patchDom(elements.actualPreview, domToVdom(elements.actualPreview), previousState);
    observer.flush();
    renderActualSource(elements, previousState);
    renderTestPanel(elements, previousState);

    isDirty = false;
    renderStatus(elements, store, isDirty);
    renderChangeList(elements, []);
  });

  elements.redoButton.addEventListener("click", () => {
    const nextState = store.redo();

    if (!nextState) {
      return;
    }

    patchDom(elements.actualPreview, domToVdom(elements.actualPreview), nextState);
    observer.flush();
    renderActualSource(elements, nextState);
    renderTestPanel(elements, nextState);

    isDirty = false;
    renderStatus(elements, store, isDirty);
    renderChangeList(elements, []);
  });
});

function createInitialVdom(elements) {
  elements.actualPreview.innerHTML = sanitizeHtml(sampleMarkup);
  const initialVdom = domToVdom(elements.actualPreview);

  renderActualPreview(elements, initialVdom);
  renderActualSource(elements, initialVdom);
  renderTestPanel(elements, initialVdom);

  return initialVdom;
}

function buildVdomFromEditor(elements) {
  renderTestPreviewFromSource(elements);
  return domToVdom(elements.testPreview);
}
