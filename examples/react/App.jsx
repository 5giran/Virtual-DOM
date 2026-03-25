import React, { useEffect, useRef, useState } from "react";

function isTextVdom(vnode) {
  return vnode && vnode.type === "TEXT";
}

function cloneVdom(vnode) {
  return JSON.parse(JSON.stringify(vnode));
}

function getNodeKey(vnode) {
  if (!vnode || isTextVdom(vnode)) return null;
  return vnode.props?.["data-key"] ?? null;
}

function domToVdom(node) {
  if (!node) return null;

  if (node.nodeType === Node.TEXT_NODE) {
    if (!node.textContent || node.textContent.trim() === "") return null;

    return {
      type: "TEXT",
      text: node.textContent,
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const props = {};

  for (const attr of Array.from(node.attributes)) {
    props[attr.name] = attr.value;
  }

  const tag = node.tagName.toLowerCase();

  if (tag === "input") {
    if (node.type === "checkbox" || node.type === "radio") {
      props.checked = node.checked;
    } else {
      props.value = node.value;
    }
  }

  if (tag === "textarea" || tag === "select") {
    props.value = node.value;
  }

  const children = [];

  for (const child of Array.from(node.childNodes)) {
    const vChild = domToVdom(child);
    if (vChild) children.push(vChild);
  }

  return {
    type: tag,
    props,
    children,
  };
}

function createDomFromVdom(vnode) {
  if (!vnode) return document.createTextNode("");

  if (isTextVdom(vnode)) {
    return document.createTextNode(vnode.text ?? "");
  }

  const el = document.createElement(vnode.type);

  for (const [key, value] of Object.entries(vnode.props || {})) {
    applyProp(el, key, value);
  }

  (vnode.children || []).forEach((child) => {
    el.appendChild(createDomFromVdom(child));
  });

  return el;
}

function applyProp(el, key, value) {
  if (value === false || value == null) {
    el.removeAttribute(key);

    if (key === "checked") el.checked = false;
    if (key === "value") el.value = "";

    return;
  }

  if (key === "checked") {
    el.checked = Boolean(value);
    if (value) el.setAttribute("checked", "");
    else el.removeAttribute("checked");
    return;
  }

  if (key === "value") {
    el.value = value;
    el.setAttribute("value", value);
    return;
  }

  el.setAttribute(key, String(value));
}

function removeProp(el, key) {
  if (key === "checked") {
    el.checked = false;
    el.removeAttribute("checked");
    return;
  }

  if (key === "value") {
    el.value = "";
    el.removeAttribute("value");
    return;
  }

  el.removeAttribute(key);
}

function getPropsDiff(oldProps = {}, newProps = {}) {
  const set = {};
  const remove = [];
  const keys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

  for (const key of keys) {
    const oldVal = oldProps[key];
    const newVal = newProps[key];

    if (!(key in newProps)) {
      remove.push(key);
    } else if (oldVal !== newVal) {
      set[key] = newVal;
    }
  }

  return { set, remove };
}

function diffTrees(oldNode, newNode, path = [], patches = []) {
  if (!oldNode && newNode) {
    patches.push({
      type: "ADD_CHILD",
      parentPath: path.slice(0, -1),
      index: path[path.length - 1],
      node: cloneVdom(newNode),
    });
    return patches;
  }

  if (oldNode && !newNode) {
    patches.push({
      type: "REMOVE_CHILD",
      parentPath: path.slice(0, -1),
      index: path[path.length - 1],
    });
    return patches;
  }

  if (!oldNode && !newNode) return patches;

  if (oldNode.type !== newNode.type) {
    patches.push({
      type: "REPLACE_NODE",
      path,
      node: cloneVdom(newNode),
    });
    return patches;
  }

  if (isTextVdom(oldNode) && isTextVdom(newNode)) {
    if (oldNode.text !== newNode.text) {
      patches.push({
        type: "TEXT_UPDATE",
        path,
        text: newNode.text,
      });
    }
    return patches;
  }

  const propChanges = getPropsDiff(oldNode.props, newNode.props);

  if (Object.keys(propChanges.set).length > 0 || propChanges.remove.length > 0) {
    patches.push({
      type: "PROPS_UPDATE",
      path,
      set: propChanges.set,
      remove: propChanges.remove,
    });
  }

  const oldChildren = oldNode.children || [];
  const newChildren = newNode.children || [];
  diffChildren(oldChildren, newChildren, path, patches);

  return patches;
}

function diffChildren(oldChildren, newChildren, path, patches) {
  if (supportsKeyedDiff(oldChildren, newChildren)) {
    diffKeyedChildren(oldChildren, newChildren, path, patches);
    return;
  }

  const maxLen = Math.max(oldChildren.length, newChildren.length);

  for (let index = 0; index < maxLen; index += 1) {
    diffTrees(oldChildren[index], newChildren[index], [...path, index], patches);
  }
}

function diffKeyedChildren(oldChildren, newChildren, path, patches) {
  const oldMap = new Map();
  const seenKeys = new Set();

  oldChildren.forEach((child, index) => {
    oldMap.set(getNodeKey(child), { child, index });
  });

  newChildren.forEach((child, newIndex) => {
    const key = getNodeKey(child);
    const match = oldMap.get(key);

    if (!match) {
      patches.push({
        type: "ADD_CHILD",
        parentPath: path,
        index: newIndex,
        node: cloneVdom(child),
      });
      return;
    }

    if (match.index !== newIndex) {
      patches.push({
        type: "MOVE_CHILD",
        parentPath: path,
        from: match.index,
        to: newIndex,
        key,
      });
    }

    seenKeys.add(key);
    diffTrees(match.child, child, [...path, newIndex], patches);
  });

  oldChildren.forEach((child, oldIndex) => {
    const key = getNodeKey(child);

    if (!seenKeys.has(key)) {
      patches.push({
        type: "REMOVE_CHILD",
        parentPath: path,
        index: oldIndex,
      });
    }
  });
}

function supportsKeyedDiff(oldChildren, newChildren) {
  const nodes = [...oldChildren, ...newChildren].filter(Boolean);

  return (
    nodes.length > 0 &&
    nodes.every((node) => !isTextVdom(node) && Boolean(getNodeKey(node)))
  );
}

function getNodeByPath(root, path) {
  let node = root;

  for (const index of path) {
    if (!node || !node.childNodes || !node.childNodes[index]) return null;
    node = node.childNodes[index];
  }

  return node;
}

function applyPatches(rootNode, patches) {
  if (!rootNode) return;

  const replacePatches = patches.filter((patch) => patch.type === "REPLACE_NODE");
  const movePatches = patches.filter((patch) => patch.type === "MOVE_CHILD");
  const textPatches = patches.filter((patch) => patch.type === "TEXT_UPDATE");
  const propsPatches = patches.filter((patch) => patch.type === "PROPS_UPDATE");
  const removePatches = patches
    .filter((patch) => patch.type === "REMOVE_CHILD")
    .sort((a, b) => {
      if (a.parentPath.length !== b.parentPath.length) {
        return b.parentPath.length - a.parentPath.length;
      }
      return b.index - a.index;
    });
  const addPatches = patches
    .filter((patch) => patch.type === "ADD_CHILD")
    .sort((a, b) => {
      if (a.parentPath.length !== b.parentPath.length) {
        return a.parentPath.length - b.parentPath.length;
      }
      return a.index - b.index;
    });

  for (const patch of replacePatches) {
    if (patch.path.length === 0) continue;
    const target = getNodeByPath(rootNode, patch.path);
    if (!target || !target.parentNode) continue;
    target.parentNode.replaceChild(createDomFromVdom(patch.node), target);
  }

  for (const patch of movePatches) {
    const parent = getNodeByPath(rootNode, patch.parentPath);
    if (!parent) continue;

    const target = Array.from(parent.childNodes).find((node) => {
      return node.nodeType === Node.ELEMENT_NODE && node.getAttribute("data-key") === patch.key;
    });

    if (!target) continue;

    const refNode = parent.childNodes[patch.to] || null;
    parent.insertBefore(target, refNode);
  }

  for (const patch of textPatches) {
    const target = getNodeByPath(rootNode, patch.path);
    if (!target) continue;
    target.textContent = patch.text;
  }

  for (const patch of propsPatches) {
    const target = getNodeByPath(rootNode, patch.path);
    if (!target || target.nodeType !== Node.ELEMENT_NODE) continue;

    patch.remove.forEach((key) => removeProp(target, key));
    Object.entries(patch.set).forEach(([key, value]) => {
      applyProp(target, key, value);
    });
  }

  for (const patch of removePatches) {
    const parent = getNodeByPath(rootNode, patch.parentPath);
    if (!parent) continue;
    const target = parent.childNodes[patch.index];
    if (target) parent.removeChild(target);
  }

  for (const patch of addPatches) {
    const parent = getNodeByPath(rootNode, patch.parentPath);
    if (!parent) continue;
    const refNode = parent.childNodes[patch.index] || null;
    parent.insertBefore(createDomFromVdom(patch.node), refNode);
  }
}

function patchToText(patch) {
  switch (patch.type) {
    case "REPLACE_NODE":
      return `노드 교체 · [${patch.path.join(", ")}]`;
    case "TEXT_UPDATE":
      return `텍스트 변경 · [${patch.path.join(", ")}]`;
    case "PROPS_UPDATE":
      return `속성 변경 · [${patch.path.join(", ")}]`;
    case "MOVE_CHILD":
      return `리스트 재정렬 · key=${patch.key}, ${patch.from} → ${patch.to}`;
    case "ADD_CHILD":
      return `자식 추가 · parent[${patch.parentPath.join(", ")}], index ${patch.index}`;
    case "REMOVE_CHILD":
      return `자식 삭제 · parent[${patch.parentPath.join(", ")}], index ${patch.index}`;
    default:
      return patch.type;
  }
}

function prettyVdom(vnode, depth = 0) {
  if (!vnode) return "";

  const indent = "  ".repeat(depth);

  if (isTextVdom(vnode)) {
    return `${indent}"${vnode.text}"`;
  }

  const props = Object.entries(vnode.props || {})
    .map(([key, value]) => `${key}="${String(value)}"`)
    .join(" ");

  const open = props ? `<${vnode.type} ${props}>` : `<${vnode.type}>`;

  if (!vnode.children || vnode.children.length === 0) {
    return `${indent}${open}</${vnode.type}>`;
  }

  return [
    `${indent}${open}`,
    ...vnode.children.map((child) => prettyVdom(child, depth + 1)),
    `${indent}</${vnode.type}>`,
  ].join("\n");
}

function renderVdomInto(container, vnode) {
  if (!container) return;
  container.innerHTML = "";
  container.appendChild(createDomFromVdom(vnode));
}

function htmlToRoot(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  return wrapper.firstElementChild;
}

function htmlToVdom(html) {
  const root = htmlToRoot(html);
  return root ? domToVdom(root) : null;
}

function vdomToHtml(vnode) {
  const wrapper = document.createElement("div");
  wrapper.appendChild(createDomFromVdom(vnode));
  return wrapper.innerHTML;
}

const SAMPLE_HTML = `
<section class="demo-card theme-blue" data-role="root">
  <div class="demo-head">
    <span class="demo-kicker">Diff Cases</span>
    <h2>Patch only the changed nodes</h2>
    <p>텍스트, class, 리스트 순서, 자식 노드를 바꿔보세요.</p>
  </div>

  <div class="chip-row">
    <span class="chip">text</span>
    <span class="chip">class</span>
    <span class="chip">reorder</span>
    <span class="chip">add/remove</span>
  </div>

  <ul class="todo-list">
    <li data-key="text">텍스트 노드 바꾸기</li>
    <li data-key="style">theme-blue 를 theme-emerald 로 바꾸기</li>
    <li data-key="move">li 순서를 바꾸기</li>
    <li data-key="child">li 추가 또는 삭제하기</li>
  </ul>

  <div class="row">
    <span class="tag">theme-blue</span>
    <button type="button">button</button>
  </div>
</section>
`.trim();

const CASES = [
  { label: "Text", hint: "p, li 텍스트 수정" },
  { label: "Color", hint: "theme class 변경" },
  { label: "Reorder", hint: "li 순서 바꾸기" },
  { label: "Add/Remove", hint: "자식 노드 추가/삭제" },
];

export default function App() {
  const actualAreaRef = useRef(null);
  const testPreviewRef = useRef(null);
  const currentVdomRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [patchLogs, setPatchLogs] = useState([]);
  const [lastPatchTime, setLastPatchTime] = useState("0.00");
  const [lastPatchCount, setLastPatchCount] = useState(0);
  const [actualVdomText, setActualVdomText] = useState("");
  const [testHtml, setTestHtml] = useState(SAMPLE_HTML);

  useEffect(() => {
    const initialVdom = htmlToVdom(SAMPLE_HTML);
    if (!initialVdom) return;

    currentVdomRef.current = cloneVdom(initialVdom);
    renderVdomInto(actualAreaRef.current, initialVdom);
    renderVdomInto(testPreviewRef.current, initialVdom);

    setHistory([cloneVdom(initialVdom)]);
    setHistoryIndex(0);
    setPatchLogs(["초기 상태"]);
    setActualVdomText(prettyVdom(initialVdom));
    setTestHtml(SAMPLE_HTML);
  }, []);

  useEffect(() => {
    const nextPreviewVdom = htmlToVdom(testHtml);

    if (!nextPreviewVdom || !testPreviewRef.current) return;

    renderVdomInto(testPreviewRef.current, nextPreviewVdom);
  }, [testHtml]);

  function handlePatch() {
    const oldVdom = currentVdomRef.current;
    const newVdom = htmlToVdom(testHtml);

    if (!oldVdom || !newVdom || !actualAreaRef.current?.firstChild) return;

    const start = performance.now();
    const patches = diffTrees(oldVdom, newVdom);
    const hasRootReplace = patches.some(
      (patch) => patch.type === "REPLACE_NODE" && patch.path.length === 0,
    );

    if (hasRootReplace) {
      renderVdomInto(actualAreaRef.current, newVdom);
    } else {
      applyPatches(actualAreaRef.current.firstChild, patches);
    }
    const end = performance.now();

    currentVdomRef.current = cloneVdom(newVdom);
    setLastPatchTime((end - start).toFixed(2));
    setLastPatchCount(patches.length);
    setPatchLogs(
      patches.length > 0 ? patches.map((patch) => patchToText(patch)) : ["변경 없음"],
    );
    setActualVdomText(prettyVdom(newVdom));

    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(cloneVdom(newVdom));
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  }

  function moveToHistory(nextIndex) {
    if (nextIndex < 0 || nextIndex >= history.length) return;

    const targetVdom = cloneVdom(history[nextIndex]);

    currentVdomRef.current = cloneVdom(targetVdom);
    renderVdomInto(actualAreaRef.current, targetVdom);
    renderVdomInto(testPreviewRef.current, targetVdom);

    setTestHtml(vdomToHtml(targetVdom));
    setHistoryIndex(nextIndex);
    setPatchLogs([`history ${nextIndex + 1} / ${history.length}`]);
    setLastPatchCount(0);
    setLastPatchTime("0.00");
    setActualVdomText(prettyVdom(targetVdom));
  }

  function handleReset() {
    const initialVdom = htmlToVdom(SAMPLE_HTML);
    if (!initialVdom) return;

    currentVdomRef.current = cloneVdom(initialVdom);
    renderVdomInto(actualAreaRef.current, initialVdom);
    renderVdomInto(testPreviewRef.current, initialVdom);

    setHistory([cloneVdom(initialVdom)]);
    setHistoryIndex(0);
    setPatchLogs(["초기 상태"]);
    setLastPatchCount(0);
    setLastPatchTime("0.00");
    setActualVdomText(prettyVdom(initialVdom));
    setTestHtml(SAMPLE_HTML);
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Virtual DOM Playground</p>
          <h1>변경된 노드만 Patch 되는 흐름 보기</h1>
          <p className="hero-copy">
            테스트 영역의 HTML을 바꾸고 Patch를 누르면 실제 영역에는 바뀐 부분만 반영됩니다.
          </p>
        </div>

        <div className="hero-metrics">
          <span>history {historyIndex + 1} / {history.length}</span>
          <span>patches {lastPatchCount}</span>
          <span>{lastPatchTime} ms</span>
        </div>
      </header>

      <section className="case-row">
        {CASES.map((item) => (
          <article key={item.label} className="case-card">
            <strong>{item.label}</strong>
            <span>{item.hint}</span>
          </article>
        ))}
      </section>

      <section className="toolbar">
        <button onClick={handlePatch}>Patch</button>
        <button onClick={() => moveToHistory(historyIndex - 1)} disabled={historyIndex <= 0}>
          뒤로가기
        </button>
        <button
          onClick={() => moveToHistory(historyIndex + 1)}
          disabled={historyIndex >= history.length - 1}
        >
          앞으로가기
        </button>
        <button onClick={handleReset} className="ghost-button">
          Reset
        </button>
      </section>

      <section className="grid">
        <article className="panel">
          <div className="panel-header">
            <h2>실제 영역</h2>
            <span>Patch target</span>
          </div>
          <div className="surface actual-surface">
            <div ref={actualAreaRef} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>테스트 영역</h2>
            <span>HTML 수정</span>
          </div>
          <div className="surface editor-surface">
            <textarea
              value={testHtml}
              onChange={(event) => setTestHtml(event.target.value)}
              spellCheck="false"
            />
          </div>
          <div className="preview-head">Preview</div>
          <div className="surface test-surface">
            <div ref={testPreviewRef} />
          </div>
        </article>
      </section>

      <section className="bottom-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Patch 로그</h2>
            <span>Diff result</span>
          </div>
          <div className="surface log-box">
            {patchLogs.map((log, index) => (
              <div key={`${log}-${index}`} className="log-line">
                <span>{index + 1}</span>
                <p>{log}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>현재 Virtual DOM</h2>
            <span>실제 영역 기준</span>
          </div>
          <pre className="surface code-box">{actualVdomText}</pre>
        </article>
      </section>

      <section className="tips">
        <strong>빠르게 보기</strong>
        <p>
          `theme-blue`를 `theme-emerald`로 바꾸기, 리스트 순서 바꾸기, `li` 추가/삭제,
          문장 수정만 해도 핵심 케이스가 바로 보입니다.
        </p>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.18), transparent 24%),
            radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.12), transparent 28%),
            #0f172a;
          color: #e2e8f0;
          font-family: Inter, Arial, sans-serif;
        }

        .app {
          max-width: 1360px;
          margin: 0 auto;
          padding: 28px 24px 40px;
        }

        .hero,
        .panel,
        .toolbar,
        .case-card,
        .tips {
          border: 1px solid #334155;
          background: rgba(15, 23, 42, 0.84);
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.24);
          border-radius: 18px;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 24px;
          align-items: flex-start;
        }

        .eyebrow {
          margin: 0 0 10px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #93c5fd;
          font-weight: 700;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(30px, 4vw, 44px);
          line-height: 1.1;
        }

        .hero-copy {
          margin: 12px 0 0;
          max-width: 60ch;
          color: #cbd5e1;
          line-height: 1.6;
        }

        .hero-metrics {
          display: grid;
          gap: 10px;
          min-width: 180px;
        }

        .hero-metrics span {
          display: block;
          padding: 10px 12px;
          background: rgba(30, 41, 59, 0.86);
          border: 1px solid #334155;
          border-radius: 12px;
          color: #bfdbfe;
          font-size: 14px;
          text-align: right;
        }

        .case-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .case-card {
          padding: 16px;
        }

        .case-card strong {
          display: block;
          color: #f8fafc;
          font-size: 15px;
        }

        .case-card span {
          display: block;
          margin-top: 8px;
          color: #94a3b8;
          font-size: 13px;
          line-height: 1.5;
        }

        .toolbar {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          margin-top: 18px;
          padding: 16px;
        }

        button {
          border: 0;
          padding: 11px 16px;
          border-radius: 10px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          font-weight: 700;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .ghost-button {
          background: #1e293b;
          color: #cbd5e1;
          border: 1px solid #334155;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1.05fr;
          gap: 20px;
          margin-top: 20px;
        }

        .bottom-grid {
          display: grid;
          grid-template-columns: 0.95fr 1.05fr;
          gap: 20px;
          margin-top: 20px;
        }

        .panel {
          overflow: hidden;
        }

        .panel-header,
        .preview-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          background: rgba(30, 41, 59, 0.82);
          border-bottom: 1px solid #334155;
        }

        .panel-header h2,
        .preview-head {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }

        .panel-header span {
          color: #94a3b8;
          font-size: 12px;
        }

        .surface {
          background: #111827;
          min-height: 260px;
          padding: 18px;
        }

        .actual-surface > div > * {
          padding: 18px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.03);
          outline: 1px dashed rgba(148, 163, 184, 0.28);
        }

        .editor-surface {
          padding: 0;
        }

        .editor-surface textarea {
          width: 100%;
          min-height: 330px;
          resize: vertical;
          border: 0;
          outline: 0;
          padding: 18px;
          background: #0b1120;
          color: #dbeafe;
          font: 13px/1.65 SFMono-Regular, Menlo, Consolas, monospace;
        }

        .test-surface > div > * {
          padding: 18px;
          border-radius: 16px;
          background: rgba(37, 99, 235, 0.08);
          outline: 1px dashed rgba(96, 165, 250, 0.36);
        }

        .log-box {
          min-height: 280px;
          max-height: 420px;
          overflow: auto;
        }

        .log-line {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }

        .log-line span {
          color: #60a5fa;
          font-weight: 700;
        }

        .log-line p {
          margin: 0;
          color: #e2e8f0;
          font-size: 14px;
        }

        .code-box {
          white-space: pre-wrap;
          word-break: break-word;
          overflow: auto;
          font: 13px/1.65 SFMono-Regular, Menlo, Consolas, monospace;
          color: #dbeafe;
        }

        .tips {
          margin-top: 20px;
          padding: 16px 18px;
        }

        .tips strong {
          display: block;
          color: #93c5fd;
        }

        .tips p {
          margin: 8px 0 0;
          color: #cbd5e1;
          line-height: 1.6;
        }

        .demo-card {
          border-radius: 18px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          transition: background 180ms ease, border-color 180ms ease;
        }

        .theme-blue {
          background: linear-gradient(180deg, rgba(37, 99, 235, 0.16), rgba(15, 23, 42, 0.72));
        }

        .theme-emerald {
          background: linear-gradient(180deg, rgba(16, 185, 129, 0.16), rgba(15, 23, 42, 0.72));
        }

        .theme-amber {
          background: linear-gradient(180deg, rgba(245, 158, 11, 0.16), rgba(15, 23, 42, 0.72));
        }

        .demo-head h2 {
          margin: 6px 0 8px;
          font-size: 24px;
        }

        .demo-head p {
          margin: 0;
          color: #cbd5e1;
          line-height: 1.6;
        }

        .demo-kicker {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          color: #bfdbfe;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .chip-row,
        .row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 16px;
          align-items: center;
        }

        .chip,
        .tag {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.18);
          color: #bfdbfe;
          font-size: 12px;
          font-weight: 700;
        }

        .todo-list {
          margin: 18px 0 0;
          padding-left: 20px;
          line-height: 1.9;
          color: #e2e8f0;
        }

        .todo-list li + li {
          margin-top: 6px;
        }

        .demo-card button {
          padding: 9px 14px;
        }

        @media (max-width: 1100px) {
          .case-row,
          .grid,
          .bottom-grid {
            grid-template-columns: 1fr;
          }

          .hero {
            flex-direction: column;
          }

          .hero-metrics {
            width: 100%;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .app {
            padding: 18px 14px 28px;
          }

          .hero-metrics {
            grid-template-columns: 1fr;
          }

          .toolbar {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
