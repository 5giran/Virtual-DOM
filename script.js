const appState = {
  currentVNode: null,
  history: [],
  historyIndex: 0,
  observer: null,
};

const refs = {};

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
  cacheDomRefs();
  setupMutationObserver();
  bootstrapFromSample();
  bindEvents();
}

function cacheDomRefs() {
  refs.actualMount = document.getElementById("actual-mount");
  refs.actualHtmlView = document.getElementById("actual-html-view");
  refs.actualVdomView = document.getElementById("actual-vdom-view");
  refs.editor = document.getElementById("editor-input");
  refs.editorNote = document.getElementById("editor-note");
  refs.patchButton = document.getElementById("patch-button");
  refs.undoButton = document.getElementById("undo-button");
  refs.redoButton = document.getElementById("redo-button");
  refs.historyIndicator = document.getElementById("history-indicator");
  refs.sampleTemplate = document.getElementById("sample-template");
}

function setupMutationObserver() {
  const observer = new MutationObserver((records) => {
    records
      .map((record) => mutationRecordToLog(record))
      .filter(Boolean)
      .forEach((entry) => {
        console.debug("[MutationObserver]", entry);
      });
  });

  observer.observe(refs.actualMount, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
    attributeOldValue: true,
    characterDataOldValue: true,
  });

  appState.observer = observer;
}

function bootstrapFromSample() {
  const sampleRoot = refs.sampleTemplate.content.firstElementChild.cloneNode(true);
  refs.actualMount.replaceChildren(sampleRoot);

  const initialDomRoot = refs.actualMount.firstElementChild;
  const initialVNode = domToVNode(initialDomRoot);

  if (!initialVNode) {
    setEditorNote("초기 샘플을 Virtual DOM으로 변환하지 못했습니다.", "error");
    return;
  }

  const normalizedHtml = serializeVNode(initialVNode);
  appState.currentVNode = cloneVNode(initialVNode);
  appState.history = [
    {
      html: normalizedHtml,
      vnode: cloneVNode(initialVNode),
    },
  ];
  appState.historyIndex = 0;

  refs.editor.value = normalizedHtml;
  syncActualInspectors(appState.currentVNode);
  updateHistoryUi();
  setEditorNote("초기 DOM을 Virtual DOM으로 변환했습니다. 이제 HTML을 수정하고 Patch를 눌러 보세요.", "success");
}

function bindEvents() {
  refs.patchButton.addEventListener("click", handlePatch);
  refs.undoButton.addEventListener("click", () => navigateHistory(-1));
  refs.redoButton.addEventListener("click", () => navigateHistory(1));
}

function handlePatch() {
  let nextVNode;

  try {
    nextVNode = parseEditorHtml(refs.editor.value);
  } catch (error) {
    setEditorNote(error.message, "error");
    return;
  }

  const patches = diffVTree(appState.currentVNode, nextVNode);
  const normalizedHtml = serializeVNode(nextVNode);
  refs.editor.value = normalizedHtml;

  if (!patches.length) {
    setEditorNote("의미 있는 DOM 변화가 없어 patch를 생략했습니다.", "info");
    return;
  }

  applyPatches(refs.actualMount, patches);
  logPatchesToConsole(patches);

  appState.currentVNode = cloneVNode(nextVNode);
  syncActualInspectors(appState.currentVNode);
  pushHistory({
    html: normalizedHtml,
    vnode: cloneVNode(nextVNode),
  });

  updateHistoryUi();
  setEditorNote(`${patches.length}개의 patch를 적용했고 history에 새 상태를 저장했습니다.`, "success");
}

function navigateHistory(direction) {
  const nextIndex = appState.historyIndex + direction;

  if (nextIndex < 0 || nextIndex >= appState.history.length) {
    return;
  }

  appState.historyIndex = nextIndex;
  const entry = appState.history[nextIndex];
  restoreSnapshot(entry);
  appState.currentVNode = cloneVNode(entry.vnode);

  updateHistoryUi();
  setEditorNote(
    `history ${nextIndex + 1} / ${appState.history.length} 상태를 복원했습니다.`,
    "info"
  );
}

function pushHistory(entry) {
  const nextHistory = appState.history.slice(0, appState.historyIndex + 1);
  nextHistory.push(entry);
  appState.history = nextHistory;
  appState.historyIndex = nextHistory.length - 1;
}

function updateHistoryUi() {
  refs.historyIndicator.textContent = `History ${appState.historyIndex + 1} / ${appState.history.length}`;
  refs.undoButton.disabled = appState.historyIndex === 0;
  refs.redoButton.disabled = appState.historyIndex === appState.history.length - 1;
}

function setEditorNote(message, tone) {
  refs.editorNote.textContent = message;
  refs.editorNote.className = `editor-note is-${tone}`;
}

function logPatchesToConsole(patches) {
  console.groupCollapsed(`[Virtual DOM Patch] ${patches.length} changes`);
  patches.forEach((patch) => {
    console.info(`${patch.type} @ ${formatPath(patch.path)} - ${describePatch(patch)}`);
  });
  console.groupEnd();
}

function restoreSnapshot(entry) {
  refs.actualMount.replaceChildren(createDomFromVNode(entry.vnode));
  refs.editor.value = entry.html;
  syncActualInspectors(entry.vnode);
}

function syncActualInspectors(vNode) {
  refs.actualHtmlView.textContent = serializeVNode(vNode);
  refs.actualVdomView.textContent = formatVNodeTree(vNode);
}

function domToVNode(node) {
  if (!node) {
    return null;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    if (!node.textContent.trim()) {
      return null;
    }

    return {
      kind: "text",
      text: node.textContent,
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const tagName = node.tagName.toLowerCase();

  if (tagName === "script" || tagName === "style") {
    return null;
  }

  const attributes = {};
  Array.from(node.attributes).forEach((attribute) => {
    attributes[attribute.name] = attribute.value;
  });

  const children = Array.from(node.childNodes)
    .map((childNode) => domToVNode(childNode))
    .filter(Boolean);

  return {
    kind: "element",
    tagName,
    attributes,
    children,
  };
}

function createDomFromVNode(vNode) {
  if (vNode.kind === "text") {
    return document.createTextNode(vNode.text);
  }

  const element = document.createElement(vNode.tagName);

  Object.entries(vNode.attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });

  vNode.children.forEach((childNode) => {
    element.append(createDomFromVNode(childNode));
  });

  return element;
}

function serializeVNode(vNode, depth = 0) {
  const indent = "  ".repeat(depth);

  if (vNode.kind === "text") {
    return `${indent}${escapeText(vNode.text)}`;
  }

  const attributesText = serializeAttributes(vNode.attributes);

  if (!vNode.children.length) {
    return `${indent}<${vNode.tagName}${attributesText}></${vNode.tagName}>`;
  }

  if (vNode.children.length === 1 && vNode.children[0].kind === "text") {
    return `${indent}<${vNode.tagName}${attributesText}>${escapeText(vNode.children[0].text)}</${vNode.tagName}>`;
  }

  const childrenText = vNode.children
    .map((childNode) => serializeVNode(childNode, depth + 1))
    .join("\n");

  return `${indent}<${vNode.tagName}${attributesText}>\n${childrenText}\n${indent}</${vNode.tagName}>`;
}

function serializeAttributes(attributes) {
  const names = Object.keys(attributes).sort();

  if (!names.length) {
    return "";
  }

  return names
    .map((name) => ` ${name}="${escapeAttribute(attributes[name])}"`)
    .join("");
}

function parseEditorHtml(htmlText) {
  const input = htmlText.trim();

  if (!input) {
    throw new Error("테스트 영역에 well-formed HTML을 입력해 주세요.");
  }

  const parser = new DOMParser();
  const xmlDocument = parser.parseFromString(`<root>${input}</root>`, "application/xml");
  const parserError = xmlDocument.querySelector("parsererror");

  if (parserError) {
    throw new Error("HTML 문법 오류가 있습니다. 태그를 닫고 속성값을 따옴표로 감싸 주세요.");
  }

  const syntheticRoot = xmlDocument.documentElement;
  const unsupportedNode = findUnsupportedNode(syntheticRoot);

  if (unsupportedNode) {
    throw new Error(`지원하지 않는 노드가 있습니다: ${unsupportedNode}. comment, script, style은 제외해 주세요.`);
  }

  const meaningfulChildren = Array.from(syntheticRoot.childNodes).filter((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      return true;
    }

    return node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "";
  });

  if (meaningfulChildren.length !== 1 || meaningfulChildren[0].nodeType !== Node.ELEMENT_NODE) {
    throw new Error("단일 루트 element 하나만 지원합니다. 최상위 태그를 하나로 감싸 주세요.");
  }

  const nextVNode = domToVNode(meaningfulChildren[0]);

  if (!nextVNode) {
    throw new Error("입력한 HTML을 Virtual DOM으로 변환하지 못했습니다.");
  }

  return nextVNode;
}

function findUnsupportedNode(node) {
  if (node.nodeType === Node.COMMENT_NODE) {
    return "comment";
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const tagName = node.tagName.toLowerCase();

    if (tagName === "script" || tagName === "style") {
      return tagName;
    }
  }

  for (const childNode of node.childNodes) {
    const unsupportedNode = findUnsupportedNode(childNode);

    if (unsupportedNode) {
      return unsupportedNode;
    }
  }

  return null;
}

function diffVTree(previousNode, nextNode, path = []) {
  const patches = [];

  if (!previousNode && nextNode) {
    patches.push({
      type: "CREATE",
      path,
      node: cloneVNode(nextNode),
    });
    return patches;
  }

  if (previousNode && !nextNode) {
    patches.push({
      type: "REMOVE",
      path,
    });
    return patches;
  }

  if (previousNode.kind !== nextNode.kind) {
    patches.push({
      type: "REPLACE",
      path,
      node: cloneVNode(nextNode),
    });
    return patches;
  }

  if (previousNode.kind === "text" && nextNode.kind === "text") {
    if (previousNode.text !== nextNode.text) {
      patches.push({
        type: "TEXT",
        path,
        text: nextNode.text,
      });
    }

    return patches;
  }

  if (previousNode.tagName !== nextNode.tagName) {
    patches.push({
      type: "REPLACE",
      path,
      node: cloneVNode(nextNode),
    });
    return patches;
  }

  const propsPatch = diffProps(previousNode.attributes, nextNode.attributes);

  if (propsPatch.removeProps.length || Object.keys(propsPatch.setProps).length) {
    patches.push({
      type: "PROPS",
      path,
      setProps: propsPatch.setProps,
      removeProps: propsPatch.removeProps,
    });
  }

  const maxLength = Math.max(previousNode.children.length, nextNode.children.length);

  for (let index = 0; index < maxLength; index += 1) {
    patches.push(
      ...diffVTree(previousNode.children[index], nextNode.children[index], [...path, index])
    );
  }

  return patches;
}

function diffProps(previousAttributes, nextAttributes) {
  const setProps = {};
  const removeProps = [];
  const allNames = new Set([
    ...Object.keys(previousAttributes),
    ...Object.keys(nextAttributes),
  ]);

  allNames.forEach((name) => {
    const previousValue = previousAttributes[name];
    const nextValue = nextAttributes[name];

    if (nextValue === undefined) {
      removeProps.push(name);
      return;
    }

    if (previousValue !== nextValue) {
      setProps[name] = nextValue;
    }
  });

  return { setProps, removeProps };
}

function applyPatches(rootContainer, patches) {
  const sortedPatches = [
    ...patches.filter((patch) => patch.type === "REMOVE").sort(compareRemovePatches),
    ...patches
      .filter((patch) => patch.type === "REPLACE" || patch.type === "TEXT" || patch.type === "PROPS")
      .sort((a, b) => comparePathAscending(a.path, b.path)),
    ...patches.filter((patch) => patch.type === "CREATE").sort(compareCreatePatches),
  ];

  sortedPatches.forEach((patch) => {
    applySinglePatch(rootContainer, patch);
  });
}

function applySinglePatch(rootContainer, patch) {
  switch (patch.type) {
    case "REMOVE": {
      const targetNode = getNodeByPath(rootContainer, patch.path);

      if (!targetNode) {
        return;
      }

      if (patch.path.length === 0) {
        rootContainer.replaceChildren();
        return;
      }

      targetNode.remove();
      return;
    }

    case "REPLACE": {
      const replacementNode = createDomFromVNode(patch.node);

      if (patch.path.length === 0) {
        rootContainer.replaceChildren(replacementNode);
        return;
      }

      const targetNode = getNodeByPath(rootContainer, patch.path);

      if (targetNode && targetNode.parentNode) {
        targetNode.parentNode.replaceChild(replacementNode, targetNode);
      }

      return;
    }

    case "TEXT": {
      const targetNode = getNodeByPath(rootContainer, patch.path);

      if (targetNode) {
        targetNode.textContent = patch.text;
      }

      return;
    }

    case "PROPS": {
      const targetNode = getNodeByPath(rootContainer, patch.path);

      if (!(targetNode instanceof Element)) {
        return;
      }

      patch.removeProps.forEach((name) => {
        targetNode.removeAttribute(name);
      });

      Object.entries(patch.setProps).forEach(([name, value]) => {
        targetNode.setAttribute(name, value);
      });

      return;
    }

    case "CREATE": {
      const newNode = createDomFromVNode(patch.node);

      if (patch.path.length === 0) {
        rootContainer.replaceChildren(newNode);
        return;
      }

      const parentNode = getParentNodeByPath(rootContainer, patch.path);
      const insertionIndex = patch.path[patch.path.length - 1];

      if (!parentNode) {
        return;
      }

      const referenceNode = parentNode.childNodes[insertionIndex] || null;
      parentNode.insertBefore(newNode, referenceNode);
      return;
    }

    default:
      return;
  }
}

function getNodeByPath(rootContainer, path) {
  let currentNode = rootContainer.firstChild;

  if (!currentNode) {
    return null;
  }

  for (const index of path) {
    currentNode = currentNode.childNodes[index];

    if (!currentNode) {
      return null;
    }
  }

  return currentNode;
}

function getParentNodeByPath(rootContainer, path) {
  if (path.length === 1) {
    return rootContainer.firstChild;
  }

  return getNodeByPath(rootContainer, path.slice(0, -1));
}

function compareRemovePatches(leftPatch, rightPatch) {
  if (leftPatch.path.length !== rightPatch.path.length) {
    return rightPatch.path.length - leftPatch.path.length;
  }

  return comparePathDescending(leftPatch.path, rightPatch.path);
}

function compareCreatePatches(leftPatch, rightPatch) {
  if (leftPatch.path.length !== rightPatch.path.length) {
    return leftPatch.path.length - rightPatch.path.length;
  }

  return comparePathAscending(leftPatch.path, rightPatch.path);
}

function comparePathAscending(leftPath, rightPath) {
  const sharedLength = Math.min(leftPath.length, rightPath.length);

  for (let index = 0; index < sharedLength; index += 1) {
    if (leftPath[index] !== rightPath[index]) {
      return leftPath[index] - rightPath[index];
    }
  }

  return leftPath.length - rightPath.length;
}

function comparePathDescending(leftPath, rightPath) {
  const sharedLength = Math.min(leftPath.length, rightPath.length);

  for (let index = 0; index < sharedLength; index += 1) {
    if (leftPath[index] !== rightPath[index]) {
      return rightPath[index] - leftPath[index];
    }
  }

  return rightPath.length - leftPath.length;
}

function cloneVNode(vNode) {
  if (vNode.kind === "text") {
    return {
      kind: "text",
      text: vNode.text,
    };
  }

  return {
    kind: "element",
    tagName: vNode.tagName,
    attributes: { ...vNode.attributes },
    children: vNode.children.map((childNode) => cloneVNode(childNode)),
  };
}

function formatVNodeTree(vNode, depth = 0) {
  const indent = "  ".repeat(depth);

  if (vNode.kind === "text") {
    return `${indent}{ kind: "text", text: "${escapeForTree(vNode.text)}" }`;
  }

  const attributeEntries = Object.entries(vNode.attributes);
  const header = `${indent}{ kind: "element", tagName: "${vNode.tagName}", attributes: ${formatAttributeObject(attributeEntries)}`;

  if (!vNode.children.length) {
    return `${header}, children: [] }`;
  }

  const childrenText = vNode.children
    .map((childNode) => formatVNodeTree(childNode, depth + 1))
    .join(",\n");

  return `${header}, children: [\n${childrenText}\n${indent}] }`;
}

function formatAttributeObject(entries) {
  if (!entries.length) {
    return "{}";
  }

  return `{ ${entries
    .map(([name, value]) => `"${name}": "${escapeForTree(value)}"`)
    .join(", ")} }`;
}

function escapeForTree(text) {
  return String(text)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n");
}

function escapeText(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(text) {
  return escapeText(text).replaceAll('"', "&quot;");
}

function describePatch(patch) {
  switch (patch.type) {
    case "CREATE":
      return `${describeVNode(patch.node)} 노드를 추가합니다.`;
    case "REMOVE":
      return "기존 노드를 제거합니다.";
    case "REPLACE":
      return `${describeVNode(patch.node)} 노드로 교체합니다.`;
    case "TEXT":
      return `텍스트를 "${shortenText(patch.text)}"(으)로 변경합니다.`;
    case "PROPS": {
      const setDescriptions = Object.entries(patch.setProps).map(
        ([name, value]) => `${name}="${value}"`
      );
      const removeDescriptions = patch.removeProps.map((name) => `${name} 제거`);
      return [...setDescriptions, ...removeDescriptions].join(", ");
    }
    default:
      return "알 수 없는 변경입니다.";
  }
}

function formatPath(path) {
  if (!path.length) {
    return "root";
  }

  return `root>${path.join(">")}`;
}

function describeVNode(vNode) {
  if (vNode.kind === "text") {
    return `text("${shortenText(vNode.text)}")`;
  }

  return `<${vNode.tagName}>`;
}

function shortenText(text) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  return normalizedText.length > 42
    ? `${normalizedText.slice(0, 39)}...`
    : normalizedText;
}

function mutationRecordToLog(record) {
  const timestamp = new Date().toLocaleTimeString("ko-KR", { hour12: false });

  if (record.type === "attributes") {
    const currentValue = record.target.getAttribute(record.attributeName);
    return `${timestamp} attributes ${describeDomNode(record.target)} ${record.attributeName}: ${record.oldValue ?? "(none)"} -> ${currentValue ?? "(removed)"}`;
  }

  if (record.type === "characterData") {
    return `${timestamp} text ${describeDomNode(record.target.parentNode)} "${shortenText(record.oldValue ?? "")}" -> "${shortenText(record.target.textContent ?? "")}"`;
  }

  if (record.type === "childList") {
    const added = Array.from(record.addedNodes).map((node) => describeDomNode(node));
    const removed = Array.from(record.removedNodes).map((node) => describeDomNode(node));
    const details = [];

    if (added.length) {
      details.push(`added ${added.join(", ")}`);
    }

    if (removed.length) {
      details.push(`removed ${removed.join(", ")}`);
    }

    if (!details.length) {
      return "";
    }

    return `${timestamp} childList ${describeDomNode(record.target)} ${details.join(" / ")}`;
  }

  return "";
}

function describeDomNode(node) {
  if (!node) {
    return "(null)";
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return `text("${shortenText(node.textContent ?? "")}")`;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return node.nodeName.toLowerCase();
  }

  const idPart = node.id ? `#${node.id}` : "";
  const classPart = node.className && typeof node.className === "string"
    ? `.${node.className.trim().split(/\s+/).filter(Boolean).join(".")}`
    : "";

  return `<${node.tagName.toLowerCase()}${idPart}${classPart}>`;
}
