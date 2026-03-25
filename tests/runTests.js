/**
 * 역할:
 * - 브라우저 페이지에서 바로 돌려볼 수 있는 간단한 통합 테스트입니다.
 */

import { diffTrees } from "../src/core/diff.js";
import { patchDom } from "../src/core/patch.js";
import { domToVdom } from "../src/core/vdom.js";
import { createHistory } from "../src/state/store.js";

const results = [];

runTest("DOM -> Virtual DOM converts nested HTML", () => {
  const container = document.createElement("div");
  container.innerHTML = `<section><h1>Hello</h1><p data-key="x">World</p></section>`;

  const vdom = domToVdom(container);

  assert(vdom.type === "fragment", "root should be a fragment");
  assert(vdom.children[0].tagName === "section", "section should exist");
  assert(vdom.children[0].children[0].tagName === "h1", "h1 should be preserved");
});

runTest("Diff finds text and attribute updates", () => {
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

runTest("History undo and redo follow cursor correctly", () => {
  const initial = { type: "fragment", children: [] };
  const history = createHistory(initial);

  history.push({ type: "fragment", children: [{ type: "text", value: "one" }] });
  history.push({ type: "fragment", children: [{ type: "text", value: "two" }] });

  const undoState = history.undo();
  const redoState = history.redo();

  assert(undoState.children[0].value === "one", "undo should move to previous state");
  assert(redoState.children[0].value === "two", "redo should move to next state");
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
