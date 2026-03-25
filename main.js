(() => {
  const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const LOG_BADGES = {
    mutation: "[MutationObserver]",
    reflow: "[Reflow 유발]",
    vdom: "[Virtual DOM]",
    diff: "[Diff]",
    history: "[History]"
  };
  const LOG_VISUAL_TYPES = {
    mutation: "mutation",
    reflow: "reflow",
    vdom: "vdom",
    diff: "vdom",
    history: "mutation"
  };

  const createWrapperFromHtml = (html) => {
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = html;
    return window.domToVdom(tempContainer);
  };

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const escapeAttribute = (value) => escapeHtml(value).replace(/"/g, "&quot;");

  const stringifyVNode = (vnode, depth = 0) => {
    const indent = "  ".repeat(depth);

    if (!vnode) {
      return "";
    }

    if (vnode.type === "#text") {
      return `${indent}${escapeHtml(vnode.children[0] || "")}`;
    }

    const props = Object.entries(vnode.props || {})
      .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
      .join("");

    if (VOID_TAGS.has(vnode.type)) {
      return `${indent}<${vnode.type}${props}>`;
    }

    const children = vnode.children || [];

    if (children.length === 0) {
      return `${indent}<${vnode.type}${props}></${vnode.type}>`;
    }

    if (children.length === 1 && children[0].type === "#text") {
      return `${indent}<${vnode.type}${props}>${escapeHtml(children[0].children[0] || "")}</${vnode.type}>`;
    }

    const childMarkup = children
      .map((child) => stringifyVNode(child, depth + 1))
      .filter(Boolean)
      .join("\n");

    return `${indent}<${vnode.type}${props}>\n${childMarkup}\n${indent}</${vnode.type}>`;
  };

  const vdomToHtml = (vdom) => {
    if (!vdom || !Array.isArray(vdom.children)) {
      return "";
    }

    return vdom.children.map((child) => stringifyVNode(child)).join("\n");
  };

  const replaceRealAreaContent = (realArea, vdom) => {
    const wrapper = window.vdomToDom(vdom);

    if (!wrapper) {
      realArea.replaceChildren();
      return;
    }

    realArea.replaceChildren(...Array.from(wrapper.childNodes));
  };

  const updateHistoryButtons = (history, undoButton, redoButton) => {
    undoButton.disabled = !history.canUndo();
    redoButton.disabled = !history.canRedo();
  };

  const createPatchStatus = (patchButton) => {
    const status = document.createElement("span");

    status.className = "patch-status";
    status.setAttribute("aria-live", "polite");
    patchButton.insertAdjacentElement("afterend", status);

    return status;
  };

  const createStatusMessenger = (statusElement) => {
    let hideTimeoutId = null;

    const clear = () => {
      if (hideTimeoutId) {
        window.clearTimeout(hideTimeoutId);
        hideTimeoutId = null;
      }

      statusElement.textContent = "";
      statusElement.classList.remove("is-visible");
    };

    const show = (message) => {
      statusElement.textContent = message;
      statusElement.classList.add("is-visible");

      if (hideTimeoutId) {
        window.clearTimeout(hideTimeoutId);
      }

      hideTimeoutId = window.setTimeout(() => {
        clear();
      }, 2000);
    };

    return { show, clear };
  };

  const countNodes = (vnode) => {
    if (!vnode) {
      return 0;
    }

    const childNodes = (vnode.children || []).filter((child) => child && typeof child === "object");

    return 1 + childNodes.reduce((total, child) => total + countNodes(child), 0);
  };

  const getDepth = (vnode) => {
    if (!vnode) {
      return 0;
    }

    const childNodes = (vnode.children || []).filter((child) => child && typeof child === "object");

    if (childNodes.length === 0) {
      return 1;
    }

    return 1 + Math.max(...childNodes.map((child) => getDepth(child)));
  };

  const summarizePatches = (patches = []) => {
    if (!Array.isArray(patches) || patches.length === 0) {
      return "변경사항 없음";
    }

    const patchOrder = ["ADD", "REMOVE", "REPLACE", "TEXT", "PROPS"];
    const patchCounts = patches.reduce((summary, patch) => {
      summary[patch.type] = (summary[patch.type] || 0) + 1;
      return summary;
    }, {});

    const groupedSummary = patchOrder
      .filter((type) => patchCounts[type])
      .map((type) => `${type} ${patchCounts[type]}개`)
      .join(", ");

    return `${groupedSummary} → 총 ${patches.length}개 패치`;
  };

  const addLogsInOrder = (addLog, entries = []) => {
    [...entries].reverse().forEach(({ type, message }) => {
      addLog(type, message);
    });
  };

  const createLogHelper = (logList) => (type, message) => {
    const entry = document.createElement("div");
    const badge = document.createElement("span");
    const body = document.createElement("div");
    const text = document.createElement("div");
    const timestamp = document.createElement("time");
    const visualType = LOG_VISUAL_TYPES[type] || "vdom";

    entry.className = "log-entry";
    badge.className = `log-badge log-badge--${visualType}`;
    badge.textContent = LOG_BADGES[type] || `[${type}]`;
    body.className = "log-entry-body";
    text.className = "log-message";
    text.textContent = message;
    timestamp.className = "log-time";
    timestamp.dateTime = new Date().toISOString();
    timestamp.textContent = new Date().toLocaleTimeString("ko-KR", {
      hour12: false
    });

    body.append(text, timestamp);
    entry.append(badge, body);
    logList.prepend(entry);
  };

  const createMutationTracker = (realArea, addLog) => {
    if (typeof MutationObserver !== "function") {
      return {
        connect() {},
        disconnect() {}
      };
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          addLog("mutation", `${mutation.target.nodeName} 자식 노드 변경 감지`);
          return;
        }

        if (mutation.type === "attributes") {
          addLog("mutation", `${mutation.target.nodeName} 속성 변경: ${mutation.attributeName}`);
          return;
        }

        if (mutation.type === "characterData") {
          addLog("mutation", "텍스트 변경 감지");
        }
      });
    });

    const options = {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    };

    return {
      connect() {
        observer.observe(realArea, options);
      },
      disconnect() {
        observer.disconnect();
      }
    };
  };

  const withObserverSuspended = (mutationTracker, callback) => {
    mutationTracker.disconnect();

    try {
      callback();
    } finally {
      mutationTracker.connect();
    }
  };

  const syncHistoryView = (realArea, editor, history, undoButton, redoButton, nextVdom, patches) => {
    replaceRealAreaContent(realArea, nextVdom);
    editor.setValue(vdomToHtml(nextVdom));
    window.highlightPatches(realArea, patches);
    console.log("[HISTORY] index:", history.index);
    updateHistoryButtons(history, undoButton, redoButton);
    editor.refresh();
  };

  document.addEventListener("DOMContentLoaded", () => {
    const realArea = document.querySelector("#real-area");
    const editorElement = document.querySelector("#editor");
    const patchButton = document.querySelector("#patch-btn");
    const undoButton = document.querySelector("#undo-btn");
    const redoButton = document.querySelector("#redo-btn");
    const clearLogButton = document.querySelector("#clear-log-btn");
    const logList = document.querySelector("#log-list");
    const patchStatus = createPatchStatus(patchButton);
    const patchStatusMessage = createStatusMessenger(patchStatus);
    const addLog = createLogHelper(logList);
    const mutationTracker = createMutationTracker(realArea, addLog);
    const history = new window.StateHistory();
    const initialMarkup = realArea.innerHTML.trim();
    const initialVdom = createWrapperFromHtml(initialMarkup);
    const sampleHtml = vdomToHtml(initialVdom);

    console.log("[INIT] vdom:", initialVdom);
    history.push(initialVdom);

    const editor = window.CodeMirror.fromTextArea(editorElement, {
      lineNumbers: true,
      mode: "htmlmixed",
      theme: "dracula",
      readOnly: false,
      tabSize: 2,
      lineWrapping: true
    });

    editor.setValue(sampleHtml);
    editor.refresh();
    editor.focus();

    clearLogButton.addEventListener("click", () => {
      logList.replaceChildren();
    });

    updateHistoryButtons(history, undoButton, redoButton);
    mutationTracker.connect();
    addLogsInOrder(addLog, [
      {
        type: "vdom",
        message: `초기 vDOM 생성 완료 → 총 ${countNodes(initialVdom)}개 노드`
      },
      {
        type: "vdom",
        message: `트리 구조: 최대 깊이 ${getDepth(initialVdom)}단계`
      }
    ]);

    patchButton.addEventListener("click", () => {
      const nextHtml = editor.getValue();
      const trimmedHtml = nextHtml.trim();

      if (!trimmedHtml) {
        patchStatusMessage.show("⚠️ 내용이 비어있습니다");
        return;
      }

      const currentVdom = history.current();
      const nextVdom = createWrapperFromHtml(nextHtml);
      const patches = window.diff(currentVdom, nextVdom);
      const patchLogs = [
        {
          type: "vdom",
          message: `이전 vDOM: ${countNodes(currentVdom)}개 노드`
        },
        {
          type: "vdom",
          message: `새 vDOM: ${countNodes(nextVdom)}개 노드`
        },
        {
          type: "diff",
          message: patches.length === 0
            ? "변경사항 없음 → DOM 조작 생략"
            : `변경 감지 → ${summarizePatches(patches)}`
        }
      ];

      if (patches.length > 0) {
        patchLogs.push({
          type: "reflow",
          message: `실제 DOM 조작: ${patches.length}개 노드만 업데이트`
        });
      }

      addLogsInOrder(addLog, patchLogs);

      if (patches.length === 0) {
        patchStatusMessage.show("변경사항이 없습니다");
        return;
      }

      patchStatusMessage.clear();

      console.log("[PATCH] old vdom:", currentVdom);
      console.log("[PATCH] new vdom:", nextVdom);
      console.log("[PATCH] patches:", patches);

      withObserverSuspended(mutationTracker, () => {
        window.applyPatches(realArea, patches);
      });
      history.push(nextVdom);
      updateHistoryButtons(history, undoButton, redoButton);
    });

    undoButton.addEventListener("click", () => {
      const currentVdom = history.current();
      const targetVdom = history.undo();
      const patches = window.diff(currentVdom, targetVdom);

      syncHistoryView(realArea, editor, history, undoButton, redoButton, targetVdom, patches);
      addLogsInOrder(addLog, [
        {
          type: "history",
          message: `← 뒤로가기 (${history.index + 1}/${history.stack.length}단계)`
        },
        {
          type: "diff",
          message: `복원 변경사항 → ${summarizePatches(patches)}`
        }
      ]);
    });

    redoButton.addEventListener("click", () => {
      const currentVdom = history.current();
      const targetVdom = history.redo();
      const patches = window.diff(currentVdom, targetVdom);

      syncHistoryView(realArea, editor, history, undoButton, redoButton, targetVdom, patches);
      addLogsInOrder(addLog, [
        {
          type: "history",
          message: `앞으로가기 → (${history.index + 1}/${history.stack.length}단계)`
        },
        {
          type: "diff",
          message: `복원 변경사항 → ${summarizePatches(patches)}`
        }
      ]);
    });
  });
})();
