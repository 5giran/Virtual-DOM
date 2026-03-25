/**
 * 역할:
 * - 브라우저 페이지에서 바로 돌려볼 수 있는 간단한 통합 테스트입니다.
 */

import { diffTrees } from "../src/core/diff.js";
import { patchDom } from "../src/core/patch.js";
import { domToVdom, htmlToVdom, serializeVdom } from "../src/core/vdom.js";
import { createHistory } from "../src/state/store.js";

const results = [];

runTest("DOM -> Virtual DOM converts nested HTML", () => {
  // 중첩된 실제 DOM 구조가 fragment/element 트리 형태의 VDOM으로 잘 변환되는지 검사합니다.
  const container = document.createElement("div");
  container.innerHTML = `<section><h1>Hello</h1><p data-key="x">World</p></section>`;

  const vdom = domToVdom(container);

  assert(vdom.type === "fragment", "root should be a fragment");
  assert(vdom.children[0].tagName === "section", "section should exist");
  assert(vdom.children[0].children[0].tagName === "h1", "h1 should be preserved");
});

runTest("Diff finds text and attribute updates", () => {
  // 같은 노드에서 텍스트 변경과 속성 변경을 동시에 diff가 찾는지 검사합니다.
  const oldTree = {
    type: "fragment",
    children: [
      {
        type: "element",
        tagName: "p",
        attrs: { class: "old" },
        children: [{ type: "text", value: "hello" }],
      },
    ],
  };

  const newTree = {
    type: "fragment",
    children: [
      {
        type: "element",
        tagName: "p",
        attrs: { class: "new", title: "greeting" },
        children: [{ type: "text", value: "hello world" }],
      },
    ],
  };

  const changes = diffTrees(oldTree, newTree);

  assert(changes.length === 3, "should detect three changes");
});

runTest("Patch updates only the changed DOM", () => {
  // keyed 리스트에서 순서 이동, 텍스트 변경, 새 항목 추가가 실제 DOM에 함께 반영되는지 검사합니다.
  const container = document.createElement("div");
  container.innerHTML = `<ul><li data-key="a">A</li><li data-key="b">B</li></ul>`;

  const oldTree = domToVdom(container);

  const nextPreview = document.createElement("div");
  nextPreview.innerHTML = `<ul><li data-key="b">B</li><li data-key="a">A*</li><li data-key="c">C</li></ul>`;
  const newTree = domToVdom(nextPreview);

  patchDom(container, oldTree, newTree);

  const values = Array.from(container.querySelectorAll("li")).map((node) => node.textContent);
  assert(
    values.join(",") === "B,A*,C",
    "keyed move + text update + insert should be reflected in DOM",
  );
});

runTest("Patch without keys falls back to index-based reconciliation", () => {
  // key가 없는 리스트는 재정렬을 move로 추적하지 못하지만 최종 DOM 결과는 요청한 순서를 따라가는지 검사합니다.
  const container = document.createElement("div");
  container.innerHTML = `<ul><li>A</li><li>B</li></ul>`;

  const oldTree = domToVdom(container);
  const nextPreview = document.createElement("div");
  nextPreview.innerHTML = `<ul><li>B</li><li>A</li></ul>`;
  const newTree = domToVdom(nextPreview);

  patchDom(container, oldTree, newTree);

  const values = Array.from(container.querySelectorAll("li")).map((node) => node.textContent);
  assert(values.join(",") === "B,A", "unkeyed list should still end up with requested final order");
});

runTest("History undo and redo follow cursor correctly", () => {
  // history 커서가 undo/redo 호출에 따라 올바른 시점으로 이동하는지 검사합니다.
  const initial = { type: "fragment", children: [] };
  const history = createHistory(initial);

  history.push({ type: "fragment", children: [{ type: "text", value: "one" }] });
  history.push({ type: "fragment", children: [{ type: "text", value: "two" }] });

  const undoState = history.undo();
  const redoState = history.redo();

  assert(undoState.children[0].value === "one", "undo should move to previous state");
  assert(redoState.children[0].value === "two", "redo should move to next state");
});

runTest("Patch replaces tag while keeping final child structure valid", () => {
  // 같은 위치의 태그가 교체될 때 실제 DOM에서도 button이 a로 안전하게 바뀌는지 검사합니다.
  const container = document.createElement("div");
  container.innerHTML = `<div><button type="button" data-role="replace-target">button</button></div>`;

  const oldTree = domToVdom(container);
  const newTree = {
    type: "fragment",
    children: [
      {
        type: "element",
        tagName: "div",
        attrs: {},
        children: [
          {
            type: "element",
            tagName: "a",
            attrs: { href: "#", "data-role": "replace-target" },
            children: [{ type: "text", value: "link" }],
          },
        ],
      },
    ],
  };

  patchDom(container, oldTree, newTree);

  const target = container.querySelector('[data-role="replace-target"]');
  assert(target.tagName === "A", "button should be replaced by anchor");
  assert(target.textContent === "link", "replacement text should match");
});

runTest("htmlToVdom sanitizes blocked tags and inline event handlers", () => {
  // HTML 문자열 입력에 script 태그나 on* 이벤트 속성이 있어도 sanitize 단계에서 제거되는지 검사합니다.
  const vdom = htmlToVdom(`
    <section onclick="alert('xss')">
      <h1>Hello</h1>
      <script>alert('boom')</script>
      <button onmouseover="hack()">Click</button>
    </section>
  `);

  const html = serializeVdom(vdom);

  assert(!html.includes("<script"), "script tag should be removed");
  assert(!html.includes("onclick"), "inline onclick handler should be removed");
  assert(!html.includes("onmouseover"), "inline mouseover handler should be removed");
  assert(html.includes("<button>Click</button>"), "safe button content should remain");
});

runTest("htmlToVdom follows browser auto-correction for malformed markup", () => {
  // 닫히지 않은 태그처럼 잘못된 HTML이 들어와도 브라우저 파서 기준으로 보정된 구조를 따르는지 검사합니다.
  const vdom = htmlToVdom(`<ul><li>one<li>two</ul>`);
  const html = serializeVdom(vdom);

  assert(html.includes("<li>one</li>"), "first list item should be auto-closed");
  assert(html.includes("<li>two</li>"), "second list item should remain");
});

runTest("domToVdom preserves whitespace inside textarea", () => {
  // textarea처럼 공백이 의미 있는 태그 안에서는 줄바꿈과 앞뒤 공백이 유지되는지 검사합니다.
  const container = document.createElement("div");
  container.innerHTML = `<textarea>  line 1
  line 2  </textarea>`;

  const vdom = domToVdom(container);
  const textarea = vdom.children[0];

  assert(textarea.tagName === "textarea", "textarea should exist");
  assert(
    textarea.children[0].value.includes("  line 1\n  line 2  "),
    "textarea whitespace should be preserved",
  );
});

runTest("Duplicate keys can collapse multiple DOM items during patch", () => {
  // 같은 key를 여러 항목에 주면 patch가 항목을 안정적으로 구분하지 못해 비정상 결과가 나올 수 있음을 재현합니다.
  const container = document.createElement("div");
  container.innerHTML = `<ul><li data-key="dup">A</li><li data-key="dup">B</li></ul>`;

  const oldTree = domToVdom(container);
  const nextPreview = document.createElement("div");
  nextPreview.innerHTML = `<ul><li data-key="dup">B</li></ul>`;
  const newTree = domToVdom(nextPreview);

  patchDom(container, oldTree, newTree);

  const values = Array.from(container.querySelectorAll("li")).map((node) => node.textContent);
  assert(values.length <= 1, "duplicate key scenario should show that DOM identity is unstable");
});

renderResults();

function runTest(name, fn) {
  try {
    fn();
    results.push({ name, status: "pass" });
  } catch (error) {
    results.push({ name, status: "fail", message: error.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function renderResults() {
  const list = document.getElementById("test-results");
  const summary = document.getElementById("test-summary");
  const failedCount = results.filter((result) => result.status === "fail").length;

  summary.textContent = failedCount === 0 ? "전체 통과" : `${failedCount}개 실패`;

  list.replaceChildren(
    ...results.map((result) => {
      const item = document.createElement("li");
      item.textContent =
        result.status === "pass"
          ? `[PASS] ${result.name}`
          : `[FAIL] ${result.name} - ${result.message}`;
      return item;
    }),
  );

  if (failedCount > 0) {
    console.error("Test failures:", results.filter((result) => result.status === "fail"));
  }
}
