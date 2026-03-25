import { createHistory } from "../core/history/createHistory.js";
import { cloneVdom } from "../core/vdom/cloneVdom.js";

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

    commit(nextVdom, changes, mutationCount) {
      currentVdom = cloneVdom(nextVdom);
      history.push(currentVdom);
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
