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
      // 같은 태그에서 텍스트와 속성이 동시에 바뀌면 둘 다 change로 잡히는지 검사합니다.
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
      // data-key가 있는 리스트 순서가 바뀌었을 때 remove/create가 아니라 move로 감지되는지 검사합니다.
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
    name: "duplicate keys make keyed diff ambiguous",
    run() {
      // 같은 key가 여러 번 나오면 diff가 항목을 안정적으로 식별하지 못해 결과가 애매해질 수 있음을 드러냅니다.
      const previous = {
        type: "fragment",
        children: [
          {
            type: "element",
            tagName: "li",
            attrs: { "data-key": "dup" },
            children: [{ type: "text", value: "A" }],
          },
          {
            type: "element",
            tagName: "li",
            attrs: { "data-key": "dup" },
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
            attrs: { "data-key": "dup" },
            children: [{ type: "text", value: "B" }],
          },
        ],
      };

      const changes = diffTrees(previous, next);
      const hasMove = changes.some((change) => change.type === "MOVE_CHILD");
      const hasRemove = changes.some((change) => change.type === "REMOVE_NODE");

      assert(hasMove || hasRemove, "duplicate key case should expose unstable keyed diff output");
    },
  },
  {
    name: "history truncates future entries after new commit",
    run() {
      // undo 이후 새 상태를 push하면 예전 redo 경로가 잘려 나가는지 검사합니다.
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
      // history snapshot 안에 이전 VDOM, 현재 VDOM, diff 정보, mutation 수가 함께 보존되는지 검사합니다.
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
      // VDOM을 사람이 읽을 수 있는 HTML 문자열로 직렬화하는 기본 동작을 검사합니다.
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
  {
    name: "diff replaces node when tag type changes at same path",
    run() {
      // 같은 위치의 태그가 button -> a처럼 바뀌면 속성 변경이 아니라 replace 한 번으로 잡히는지 검사합니다.
      const previous = {
        type: "fragment",
        children: [
          {
            type: "element",
            tagName: "button",
            attrs: { type: "button", "data-role": "replace-target" },
            children: [{ type: "text", value: "button" }],
          },
        ],
      };

      const next = {
        type: "fragment",
        children: [
          {
            type: "element",
            tagName: "a",
            attrs: { href: "#", "data-role": "replace-target" },
            children: [{ type: "text", value: "link" }],
          },
        ],
      };

      const changes = diffTrees(previous, next);

      assert(changes.length === 1, "tag replacement should collapse to a single replace change");
      assert(changes[0].type === "REPLACE_NODE", "change type should be REPLACE_NODE");
    },
  },
  {
    name: "store getters return clones so external mutation does not leak back",
    run() {
      // store에서 꺼낸 객체를 바깥에서 수정해도 원본 상태가 오염되지 않는지 검사합니다.
      const initial = {
        type: "fragment",
        children: [{ type: "text", value: "safe" }],
      };
      const store = createStore(initial);
      const snapshot = store.getCurrentVdom();

      snapshot.children[0].value = "mutated outside";

      assert(
        store.getCurrentVdom().children[0].value === "safe",
        "current vdom should stay immutable from caller perspective",
      );
    },
  },
  {
    name: "store undo and redo keep current and draft in sync",
    run() {
      // undo/redo 이후에는 actual 기준 상태와 draft 기준 상태가 다시 같은 값으로 맞춰지는지 검사합니다.
      const initial = { type: "fragment", children: [{ type: "text", value: "start" }] };
      const next = { type: "fragment", children: [{ type: "text", value: "after patch" }] };
      const store = createStore(initial);

      store.commit(next, [{ type: "UPDATE_TEXT", path: [0] }], 1);
      store.undo();

      assert(
        store.getCurrentVdom().children[0].value === store.getDraftVdom().children[0].value,
        "undo should resync current and draft",
      );

      store.redo();

      assert(
        store.getCurrentVdom().children[0].value === store.getDraftVdom().children[0].value,
        "redo should resync current and draft",
      );
    },
  },
  {
    name: "store jumpTo moves current and draft to selected history entry",
    run() {
      // history 숫자 클릭처럼 특정 시점으로 이동했을 때 current/draft가 함께 그 시점 상태로 바뀌는지 검사합니다.
      const initial = { type: "fragment", children: [{ type: "text", value: "start" }] };
      const store = createStore(initial);

      store.commit(
        { type: "fragment", children: [{ type: "text", value: "one" }] },
        [{ type: "UPDATE_TEXT", path: [0] }],
        1,
      );
      store.commit(
        { type: "fragment", children: [{ type: "text", value: "two" }] },
        [{ type: "UPDATE_TEXT", path: [0] }],
        1,
      );

      const snapshot = store.jumpTo(0);

      assert(snapshot !== null, "jump target snapshot should exist");
      assert(store.getHistoryMeta().index === 0, "history cursor should move to selected index");
      assert(store.getCurrentVdom().children[0].value === "start", "current vdom should match jumped state");
      assert(store.getDraftVdom().children[0].value === "start", "draft vdom should match jumped state");
    },
  },
  {
    name: "serializeVdom escapes text and attribute HTML characters",
    run() {
      // 직렬화할 때 <, >, &, 따옴표 같은 문자가 안전하게 escape되는지 검사합니다.
      const html = serializeVdom({
        type: "fragment",
        children: [
          {
            type: "element",
            tagName: "div",
            attrs: { title: '"quoted" <unsafe> &' },
            children: [{ type: "text", value: '5 < 7 & "safe"' }],
          },
        ],
      });

      assert(
        html.includes('title="&quot;quoted&quot; &lt;unsafe&gt; &amp;"'),
        "attribute should be escaped",
      );
      assert(html.includes('5 &lt; 7 &amp; "safe"'), "text should escape angle brackets and ampersands");
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
