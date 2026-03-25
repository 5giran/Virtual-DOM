export function getElements() {
  return {
    actualPreview: requiredElement("actual-preview"),
    actualSource: requiredElement("actual-source"),
    testPreview: requiredElement("test-preview"),
    testSource: requiredElement("test-source"),
    patchButton: requiredElement("patch-button"),
    undoButton: requiredElement("undo-button"),
    redoButton: requiredElement("redo-button"),
    changeCount: requiredElement("change-count"),
    mutationCount: requiredElement("mutation-count"),
    historyPosition: requiredElement("history-position"),
    dirtyIndicator: requiredElement("dirty-indicator"),
    changeList: requiredElement("change-list"),
  };
}

function requiredElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required element #${id} was not found.`);
  }

  return element;
}
