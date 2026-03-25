/**
 * 역할:
 * - 브라우저 없이도 핵심 알고리즘이 깨지지 않았는지 확인하는 Node 테스트입니다.
 */

import { diffTrees } from "../src/core/diff.js";
import { createHistory, createStore } from "../src/state/store.js";
import { serializeVdom } from "../src/core/vdom.js";

const tests = [
  {
    name: "diff detects text and attribute changes",
    run() {
      const previous = {
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

      const next = {
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

      const changes = diffTrees(previous, next);

      assert(changes.length === 3, "expected 3 changes");
    },
  },
  {
    name: "diff reports keyed move",
    run() {
      const previous = {
        type: "fragment",
        children: [
          {
            type: "element",
            tagName: "li",
            attrs: { "data-key": "a" },
            children: [{ type: "text", value: "A" }],
          },
          {
            type: "element",
            tagName: "li",
            attrs: { "data-key": "b" },
            children: [{ type: "text", value: "B" }],
          },
        ],
      };

      const next = {
        type: "fragment",
        children: [
          {
            type: "element",
            tagName: "li",
            attrs: { "data-key": "b" },
            children: [{ type: "text", value: "B" }],
          },
          {
            type: "element",
            tagName: "li",
            attrs: { "data-key": "a" },
            children: [{ type: "text", value: "A" }],
          },
        ],
      };

      const changes = diffTrees(previous, next);
      const moveCount = changes.filter((change) => change.type === "MOVE_CHILD").length;

      assert(moveCount === 2, "expected keyed move changes");
    },
  },
  {
    name: "history truncates future entries after new commit",
    run() {
      const history = createHistory({ type: "fragment", children: [] });

      history.push({ type: "fragment", children: [{ type: "text", value: "one" }] });
      history.push({ type: "fragment", children: [{ type: "text", value: "two" }] });
      history.undo();
      history.push({ type: "fragment", children: [{ type: "text", value: "three" }] });

      assert(history.size() === 3, "future entries should be truncated");
      assert(history.canRedo() === false, "redo should be unavailable after new push");
    },
  },
  {
    name: "store snapshots preserve previous vdom and change metadata",
    run() {
      const initial = { type: "fragment", children: [] };
      const next = { type: "fragment", children: [{ type: "text", value: "next" }] };
      const changes = [{ type: "CREATE", path: [0] }];
      const store = createStore(initial);

      store.commit(next, changes, 2);

      const snapshot = store.getSnapshotAt(1);

      assert(snapshot !== null, "snapshot should exist");
      assert(snapshot.previousVdom.children.length === 0, "snapshot should store previous vdom");
      assert(snapshot.vdom.children[0].value === "next", "snapshot should store current vdom");
      assert(snapshot.changes.length === 1, "snapshot should store changes");
      assert(snapshot.mutationCount === 2, "snapshot should store mutation count");
    },
  },
  {
    name: "serializeVdom produces readable HTML",
    run() {
      const html = serializeVdom({
        type: "fragment",
        children: [
          {
            type: "element",
            tagName: "section",
            attrs: { class: "card" },
            children: [
              {
                type: "element",
                tagName: "h1",
                attrs: {},
                children: [{ type: "text", value: "Title" }],
              },
            ],
          },
        ],
      });

      assert(html.includes('<section class="card">'), "section opening tag should exist");
      assert(html.includes("<h1>Title</h1>"), "heading should be serialized inline");
    },
  },
];

const failures = [];

for (const test of tests) {
  try {
    test.run();
    console.log(`[PASS] ${test.name}`);
  } catch (error) {
    failures.push({ name: test.name, message: error.message });
    console.error(`[FAIL] ${test.name} - ${error.message}`);
  }
}

if (failures.length > 0) {
  process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
