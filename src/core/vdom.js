/**
 * 역할:
 * - 브라우저 DOM <-> Virtual DOM 변환을 담당합니다.
 * - Virtual DOM을 실제 DOM/HTML 문자열로 바꾸는 기능도 함께 둡니다.
 * - clone, sanitize, key 추출처럼 VDOM 주변에서 자주 같이 쓰는 헬퍼도 모아둡니다.
 *
 * 이 파일을 읽어야 하는 경우:
 * - DOM이 어떤 형태의 Virtual DOM 객체로 바뀌는지 알고 싶을 때
 * - Virtual DOM이 실제 DOM이나 HTML 문자열로 어떻게 만들어지는지 보고 싶을 때
 *
 * 관련 파일:
 * - diff.js: 두 Virtual DOM을 비교합니다.
 * - patch.js: 이전/다음 Virtual DOM을 바탕으로 실제 DOM을 갱신합니다.
 * - ../main.js: 전체 앱 흐름에서 이 기능들을 사용합니다.
 */

const IGNORED_ATTRIBUTES = new Set(["contenteditable", "spellcheck"]);
const WHITESPACE_SENSITIVE_TAGS = new Set(["pre", "textarea"]);
const VOID_ELEMENTS = new Set([
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
const BOOLEAN_ATTRIBUTES = new Set([
  "checked",
  "disabled",
  "hidden",
  "open",
  "readonly",
  "required",
  "selected",
]);
const BOOLEAN_PROPERTY_MAP = {
  readonly: "readOnly",
};
const BLOCKED_SELECTORS = "script, iframe, object, embed";

export function cloneVdom(vnode) {
  // VDOM을 복사해서 원본 상태가 함께 바뀌는 일을 막습니다.
  if (!vnode) {
    return null;
  }

  return JSON.parse(JSON.stringify(vnode));
}

export function getNodeKey(vnode) {
  // 리스트 항목 구분에 쓰는 key(data-key)를 꺼냅니다.
  if (!vnode || vnode.type !== "element") {
    return null;
  }

  return vnode.attrs?.["data-key"] ?? vnode.attrs?.key ?? null;
}

export function sanitizeHtml(input) {
  // 샘플 HTML에서 위험한 태그와 이벤트 속성을 제거합니다.
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");

  doc.querySelectorAll(BLOCKED_SELECTORS).forEach((node) => node.remove());

  for (const element of doc.body.querySelectorAll("*")) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  return doc.body.innerHTML.trim();
}

export function domToVdom(container) {
  // 실제 DOM을 우리 프로젝트가 쓰는 VDOM 객체로 바꿉니다.
  return {
    type: "fragment",
    children: Array.from(container.childNodes)
      .map((child) => domNodeToVdom(child, container))
      .filter(Boolean),
  };
}

export function htmlToVdom(input) {
  // HTML 문자열을 sanitize한 뒤 VDOM으로 변환합니다.
  const parser = new DOMParser();
  const sanitized = sanitizeHtml(input ?? "");
  const doc = parser.parseFromString(sanitized, "text/html");
  return domToVdom(doc.body);
}

export function createDomFromVdom(vnode) {
  // VDOM 노드 하나를 실제 DOM 노드로 생성합니다.
  if (vnode.type === "fragment") {
    const fragment = document.createDocumentFragment();

    for (const child of vnode.children) {
      fragment.append(createDomFromVdom(child));
    }

    return fragment;
  }

  if (vnode.type === "text") {
    return document.createTextNode(vnode.value);
  }

  const element = document.createElement(vnode.tagName);
  syncAttributes(element, {}, vnode.attrs ?? {});

  if (!VOID_ELEMENTS.has(vnode.tagName)) {
    for (const child of vnode.children ?? []) {
      element.append(createDomFromVdom(child));
    }
  }

  return element;
}

export function renderVdom(container, vnode) {
  // 컨테이너 안 내용을 VDOM 기준으로 다시 렌더링합니다.
  container.replaceChildren(createDomFromVdom(vnode));
}

export function syncAttributes(element, oldAttrs = {}, newAttrs = {}) {
  // 이전 속성과 새 속성을 비교해 필요한 속성만 바꿉니다.
  for (const name of Object.keys(oldAttrs)) {
    if (!(name in newAttrs)) {
      removeAttribute(element, name);
    }
  }

  for (const [name, value] of Object.entries(newAttrs)) {
    if (oldAttrs[name] !== value) {
      setAttribute(element, name, value);
    }
  }
}

export function serializeVdom(vnode) {
  // VDOM을 화면 아래 비교 패널에 보여줄 HTML 문자열로 바꿉니다.
  return stringifyNode(vnode, 0).trim();
}

function domNodeToVdom(node, parentNode) {
  // DOM 노드 하나를 재귀적으로 읽어 VDOM 노드로 변환합니다.
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.textContent ?? "";

    if (!shouldKeepTextNode(value, parentNode)) {
      return null;
    }

    return {
      type: "text",
      value,
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  if (node.hasAttribute("data-editor-control")) {
    return null;
  }

  const tagName = node.tagName.toLowerCase();
  const attrs = collectAttributes(node);

  return {
    type: "element",
    tagName,
    attrs,
    children: Array.from(node.childNodes)
      .map((child) => domNodeToVdom(child, node))
      .filter(Boolean),
  };
}

function shouldKeepTextNode(value, parentNode) {
  // 의미 없는 공백 텍스트는 버리고 필요한 텍스트만 남깁니다.
  if (!parentNode || parentNode.nodeType !== Node.ELEMENT_NODE) {
    return value.trim().length > 0;
  }

  const tagName = parentNode.tagName.toLowerCase();

  if (WHITESPACE_SENSITIVE_TAGS.has(tagName)) {
    return true;
  }

  return value.trim().length > 0;
}

function collectAttributes(element) {
  // DOM 요소의 속성들을 attrs 객체로 모읍니다.
  const attrs = {};

  for (const name of element.getAttributeNames()) {
    if (IGNORED_ATTRIBUTES.has(name)) {
      continue;
    }

    attrs[name] = element.getAttribute(name) ?? "";
  }

  if (element instanceof HTMLInputElement) {
    attrs.value = element.value;

    if (element.type === "checkbox" || element.type === "radio") {
      if (element.checked) {
        attrs.checked = "";
      } else {
        delete attrs.checked;
      }
    }
  }

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    attrs.value = element.value;
  }

  if (element instanceof HTMLOptionElement && element.selected) {
    attrs.selected = "";
  }

  if (element instanceof HTMLDetailsElement && element.open) {
    attrs.open = "";
  }

  return attrs;
}

function setAttribute(element, name, value) {
  // 속성 하나를 실제 DOM에 반영합니다.
  if (name === "value") {
    element.value = value ?? "";
    element.setAttribute(name, value ?? "");
    return;
  }

  if (BOOLEAN_ATTRIBUTES.has(name)) {
    if (value === false || value == null) {
      element.removeAttribute(name);
      const propertyName = BOOLEAN_PROPERTY_MAP[name] ?? name;

      if (propertyName in element) {
        element[propertyName] = false;
      }

      return;
    }

    element.setAttribute(name, "");
    const propertyName = BOOLEAN_PROPERTY_MAP[name] ?? name;

    if (propertyName in element) {
      element[propertyName] = true;
    }

    return;
  }

  element.setAttribute(name, value);
}

function removeAttribute(element, name) {
  // 속성 하나를 실제 DOM에서 제거합니다.
  if (name === "value") {
    element.value = "";
  }

  if (BOOLEAN_ATTRIBUTES.has(name)) {
    const propertyName = BOOLEAN_PROPERTY_MAP[name] ?? name;

    if (propertyName in element) {
      element[propertyName] = false;
    }
  }

  element.removeAttribute(name);
}

function stringifyNode(vnode, depth) {
  // VDOM을 보기 좋은 HTML 문자열로 출력하는 내부 재귀 함수입니다.
  if (!vnode) {
    return "";
  }

  if (vnode.type === "fragment") {
    return vnode.children.map((child) => stringifyNode(child, depth)).join("\n");
  }

  if (vnode.type === "text") {
    return `${indent(depth)}${escapeHtml(vnode.value)}`;
  }

  const attrs = Object.entries(vnode.attrs ?? {})
    .map(([name, value]) =>
      value === "" ? name : `${name}="${escapeAttribute(String(value))}"`,
    )
    .join(" ");

  const openingTag = attrs ? `<${vnode.tagName} ${attrs}>` : `<${vnode.tagName}>`;

  if (VOID_ELEMENTS.has(vnode.tagName)) {
    return `${indent(depth)}${openingTag}`;
  }

  if (!vnode.children || vnode.children.length === 0) {
    return `${indent(depth)}${openingTag}</${vnode.tagName}>`;
  }

  if (hasOnlyTextChildren(vnode)) {
    const textContent = vnode.children
      .map((child) => (child.type === "text" ? escapeHtml(child.value) : stringifyNode(child, 0)))
      .join("");

    return `${indent(depth)}${openingTag}${textContent}</${vnode.tagName}>`;
  }

  const children = vnode.children
    .map((child) => stringifyNode(child, depth + 1))
    .join("\n");

  return `${indent(depth)}${openingTag}\n${children}\n${indent(depth)}</${vnode.tagName}>`;
}

function hasOnlyTextChildren(vnode) {
  // 자식이 전부 텍스트인지 검사해서 출력 방식을 고릅니다.
  return vnode.children.every((child) => child.type === "text");
}

function indent(depth) {
  // 문자열 직렬화에 쓰는 들여쓰기 helper입니다.
  return "  ".repeat(depth);
}

function escapeHtml(value) {
  // 텍스트 내용을 HTML 안전 문자열로 바꿉니다.
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  // 속성값을 HTML 안전 문자열로 바꿉니다.
  return escapeHtml(value).replaceAll('"', "&quot;");
}
