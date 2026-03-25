(() => {
  class StateHistory {
    constructor() {
      this.stack = [];
      this.index = -1;
    }

    push(vdom) {
      this.stack = this.stack.slice(0, this.index + 1);
      this.stack.push(vdom);
      this.index = this.stack.length - 1;
      return this.current();
    }

    undo() {
      if (!this.canUndo()) {
        return this.current();
      }

      this.index -= 1;
      return this.current();
    }

    redo() {
      if (!this.canRedo()) {
        return this.current();
      }

      this.index += 1;
      return this.current();
    }

    canUndo() {
      return this.index > 0;
    }

    canRedo() {
      return this.index < this.stack.length - 1;
    }

    current() {
      return this.stack[this.index];
    }
  }

  window.StateHistory = StateHistory;
})();
