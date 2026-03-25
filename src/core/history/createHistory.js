import { cloneVdom } from "../vdom/cloneVdom.js";

export function createHistory(initialVdom) {
  let entries = [cloneVdom(initialVdom)];
  let cursor = 0;

  return {
    push(nextVdom) {
      entries = entries.slice(0, cursor + 1);
      entries.push(cloneVdom(nextVdom));
      cursor = entries.length - 1;
    },

    undo() {
      if (cursor === 0) {
        return null;
      }

      cursor -= 1;
      return cloneVdom(entries[cursor]);
    },

    redo() {
      if (cursor >= entries.length - 1) {
        return null;
      }

      cursor += 1;
      return cloneVdom(entries[cursor]);
    },

    current() {
      return cloneVdom(entries[cursor]);
    },

    canUndo() {
      return cursor > 0;
    },

    canRedo() {
      return cursor < entries.length - 1;
    },

    size() {
      return entries.length;
    },

    index() {
      return cursor;
    },
  };
}
