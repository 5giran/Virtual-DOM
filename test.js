const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = __dirname;
const context = {
  console,
  window: {}
};

context.global = context;
vm.createContext(context);

const loadScript = (fileName) => {
  const filePath = path.join(projectRoot, fileName);
  const source = fs.readFileSync(filePath, "utf8");
  vm.runInContext(source, context, { filename: filePath });
};

loadScript("diff.js");
loadScript("history.js");

const { diff, StateHistory } = context.window;

const results = [];

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const isPlainObject = (value) => Object.prototype.toString.call(value) === "[object Object]";

const runCase = (name, testFn) => {
  try {
    testFn();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
};

runCase("1. vNode structure equivalent", () => {
  const vnode = {
    type: "div",
    props: {
      id: "app",
      class: "card"
    },
    children: [
      {
        type: "h2",
        props: {},
        children: [
          {
            type: "#text",
            props: {},
            children: ["Virtual DOM Demo"]
          }
        ]
      }
    ]
  };

  assert(vnode.type === "div", "root type should be div");
  assert(isPlainObject(vnode.props), "props should be a plain object");
  assert(vnode.props.id === "app", "id prop should be preserved");
  assert(vnode.props.class === "card", "class prop should be preserved");
  assert(Array.isArray(vnode.children), "children should be an array");
  assert(vnode.children.length === 1, "children length should be 1");
  assert(vnode.children[0].type === "h2", "child type should be h2");
  assert(vnode.children[0].children[0].type === "#text", "nested text node should use #text type");
  assert(vnode.children[0].children[0].children[0] === "Virtual DOM Demo", "text content should match");
});

runCase("2. diff ADD", () => {
  const nextNode = {
    type: "div",
    props: { class: "card" },
    children: []
  };
  const patches = diff(null, nextNode);

  assert(patches.length === 1, "should create exactly one patch");
  assert(patches[0].type === "ADD", "patch type should be ADD");
  assert(patches[0].vnode === nextNode, "patch should include the added vnode");
});

runCase("3. diff REMOVE", () => {
  const currentNode = {
    type: "div",
    props: { class: "card" },
    children: []
  };
  const patches = diff(currentNode, null);

  assert(patches.length === 1, "should create exactly one patch");
  assert(patches[0].type === "REMOVE", "patch type should be REMOVE");
});

runCase("4. diff REPLACE", () => {
  const patches = diff(
    { type: "div", props: {}, children: [] },
    { type: "span", props: {}, children: [] }
  );

  assert(patches.length === 1, "should create exactly one patch");
  assert(patches[0].type === "REPLACE", "patch type should be REPLACE");
  assert(patches[0].vnode.type === "span", "replacement vnode should be span");
});

runCase("5. diff TEXT", () => {
  const patches = diff(
    { type: "#text", props: {}, children: ["hello"] },
    { type: "#text", props: {}, children: ["world"] }
  );

  assert(patches.length === 1, "should create exactly one patch");
  assert(patches[0].type === "TEXT", "patch type should be TEXT");
  assert(patches[0].text === "world", "new text should be world");
});

runCase("6. diff PROPS", () => {
  const patches = diff(
    { type: "div", props: { class: "old", "data-id": "1" }, children: [] },
    { type: "div", props: { class: "new", style: "color:red" }, children: [] }
  );

  assert(patches.length === 1, "should create exactly one patch");
  assert(patches[0].type === "PROPS", "patch type should be PROPS");
  assert(patches[0].props.class === "new", "class should be updated");
  assert(patches[0].props.style === "color:red", "style should be added");
  assert(patches[0].props["data-id"] === null, "removed prop should be null");
});

runCase("7. diff child recursion", () => {
  const oldTree = {
    type: "div",
    props: {},
    children: [
      {
        type: "ul",
        props: {},
        children: [
          {
            type: "li",
            props: {},
            children: [
              { type: "#text", props: {}, children: ["Item 1"] }
            ]
          },
          {
            type: "li",
            props: {},
            children: [
              { type: "#text", props: {}, children: ["Item 2"] }
            ]
          }
        ]
      }
    ]
  };

  const newTree = {
    type: "div",
    props: {},
    children: [
      {
        type: "ul",
        props: {},
        children: [
          {
            type: "li",
            props: {},
            children: [
              { type: "#text", props: {}, children: ["Item 1"] }
            ]
          },
          {
            type: "li",
            props: {},
            children: [
              { type: "#text", props: {}, children: ["Item 2 updated"] }
            ]
          }
        ]
      }
    ]
  };

  const patches = diff(oldTree, newTree);

  assert(patches.length === 1, "only the changed child should produce a patch");
  assert(patches[0].type === "TEXT", "nested change should resolve to a TEXT patch");
  assert(patches[0].index === 5, "nested changed child should use the expected depth-first index");
  assert(patches[0].text === "Item 2 updated", "nested text should be updated");
});

runCase("8. StateHistory push/undo/redo", () => {
  const history = new StateHistory();
  const first = { step: 1 };
  const second = { step: 2 };
  const third = { step: 3 };

  history.push(first);
  history.push(second);

  assert(history.current() === second, "current should point to the latest item");
  assert(history.canUndo() === true, "canUndo should be true after two pushes");
  assert(history.canRedo() === false, "canRedo should be false at the latest item");

  const undone = history.undo();
  assert(undone === first, "undo should return the previous item");
  assert(history.current() === first, "current should move back after undo");
  assert(history.canUndo() === false, "canUndo should be false at the start");
  assert(history.canRedo() === true, "canRedo should be true after undo");

  const redone = history.redo();
  assert(redone === second, "redo should return the next item");
  assert(history.current() === second, "current should move forward after redo");

  history.undo();
  history.push(third);
  assert(history.current() === third, "push after undo should move current to the new item");
  assert(history.canRedo() === false, "redo stack should be truncated after push");
});

results.forEach((result) => {
  if (result.status === "PASS") {
    console.log(`PASS - ${result.name}`);
    return;
  }

  console.log(`FAIL - ${result.name}: ${result.error}`);
});

const failed = results.filter((result) => result.status === "FAIL");

if (failed.length > 0) {
  process.exitCode = 1;
}
