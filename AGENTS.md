# Project: Virtual DOM & Diff Algorithm Demo

## Overview
Vanilla JavaScript implementation of React's Virtual DOM and Diff algorithm concepts.
No frameworks, no build tools, no npm. Pure HTML/CSS/JS.

## File Structure
```
/
├── index.html      # UI layout, sample HTML, loads all scripts
├── style.css       # UI styles
├── vdom.js         # domToVdom(), vdomToDom()
├── diff.js         # diff(oldVnode, newVnode) → patches[]
├── patch.js        # applyPatches(domRoot, patches)
├── history.js      # StateHistory class
└── main.js         # Event wiring, app entry point
```

## Tech Stack
- Vanilla HTML / CSS / JavaScript (ES6+)
- CodeMirror 5 via CDN (code editor in test area)
- No bundler, no TypeScript, no frameworks

## How to Run
```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Coding Conventions
- Use ES6+ (const/let, arrow functions, template literals)
- Each file has a single responsibility (see file structure above)
- Expose functions on `window` object (e.g. `window.domToVdom = domToVdom`)
- No external libraries except CodeMirror 5 (CDN only)
- Add console.log at key steps for debugging (see Testing section)

## Core Data Structure

### vNode
```js
{
  type: 'div',       // tagName lowercase, or '#text'
  props: {           // all HTML attributes as key-value
    id: 'app',
    class: 'card',
  },
  children: []       // array of vNode or string (for text nodes)
}
```

## Core Constraints

### vdom.js
- `domToVdom(domNode)` recursively converts a real DOM node to a vNode
- Skip comment nodes (nodeType === 8)
- Skip whitespace-only text nodes
- Text nodes → `{ type: '#text', props: {}, children: [textContent] }`
- Element nodes → `{ type: tagName.toLowerCase(), props: {all attributes}, children: [...] }`
- `vdomToDom(vNode)` creates real DOM elements from a vNode tree

### diff.js
- `diff(oldVnode, newVnode, index=0)` returns a `patches` array
- Must handle exactly these 5 patch types in order:
  1. `ADD`     — oldVnode is null/undefined, newVnode exists
  2. `REMOVE`  — oldVnode exists, newVnode is null/undefined
  3. `REPLACE` — both exist but type differs (different tagName)
  4. `TEXT`    — both are '#text' but text content differs
  5. `PROPS`   — same type: diff props, then recurse into children
- Children diffing: zip old and new children arrays by index (no key-based reconciliation needed)

### patch.js
- `applyPatches(realDomRoot, patches)` walks real DOM in depth-first order
- Applies each patch to the matching node:
  - `ADD`     → appendChild with vdomToDom(newVnode)
  - `REMOVE`  → remove node from parent
  - `REPLACE` → replaceChild with vdomToDom(newVnode)
  - `TEXT`    → update nodeValue
  - `PROPS`   → setAttribute / removeAttribute
- After applying any patch, add class `highlight-changed` to the affected node
- Remove `highlight-changed` after 1500ms via setTimeout

### history.js
- `StateHistory` class with: `stack[]`, `index` pointer
- `push(vdom)`  → truncate stack after current index, append, advance index
- `undo()`      → decrement index, return `stack[index]`
- `redo()`      → increment index, return `stack[index]`
- `canUndo()`   → `index > 0`
- `canRedo()`   → `index < stack.length - 1`
- `current()`   → `stack[index]`

### main.js
On DOMContentLoaded:
1. Read innerHTML of `#real-area`
2. Convert to vdom via `domToVdom`
3. Push to history
4. Initialize CodeMirror on `#editor` textarea with the sample HTML string

On Patch button click:
1. Get HTML string from CodeMirror `.getValue()`
2. Parse: create temp div → set innerHTML → call `domToVdom`
3. Get current vdom from `history.current()`
4. Run `diff(currentVdom, newVdom)`
5. `applyPatches(#real-area, patches)`
6. `history.push(newVdom)`
7. Update undo/redo button disabled states

On Undo / Redo button click:
1. Call `history.undo()` or `history.redo()` → get target vdom
2. Re-render `#real-area` by replacing its content with `vdomToDom(targetVdom)`
3. Update CodeMirror value with HTML string of target vdom
4. Update button disabled states

## UI Layout (index.html)

```
┌─────────────────────────────────────────────────┐
│  Virtual DOM & Diff Demo                        │
├────────────────────┬────────────────────────────┤
│   실제 영역         │   테스트 영역               │
│   #real-area       │   CodeMirror #editor        │
│   (live DOM)       │   (editable HTML code)      │
│                    │                             │
├────────────────────┴────────────────────────────┤
│  [← 뒤로가기]        [Patch]        [앞으로가기 →] │
└─────────────────────────────────────────────────┘
```

- `뒤로가기` disabled when `history.canUndo()` is false
- `앞으로가기` disabled when `history.canRedo()` is false

## Sample HTML (preload in #real-area and CodeMirror)
```html
<div class="card">
  <h2>Virtual DOM Demo</h2>
  <p>Edit this content in the test area and press Patch.</p>
  <ul>
    <li>Item 1</li>
    <li>Item 2</li>
    <li>Item 3</li>
  </ul>
  <button>Click me</button>
</div>
```

## CSS
- `.highlight-changed` class:
  ```css
  outline: 2px solid #f59e0b;
  background: rgba(245, 158, 11, 0.15);
  transition: all 0.3s ease;
  ```
- Dark-themed UI preferred
- CodeMirror editor fills full height of its panel

## Testing
Open browser console and verify:
1. On page load: initial vdom tree is logged
2. On Patch: logs old vdom, new vdom, and patches array
3. Changed nodes briefly highlight in the real area
4. Undo/Redo restores both real-area and CodeMirror correctly

## Edge Cases to Handle
- Empty children arrays
- Whitespace-only text nodes → skip in domToVdom
- Self-closing tags (img, input, br, hr) → no children in vNode
- props diffing: handle `class`, `style` (as string), `data-*` attributes
- If patch index doesn't find a matching DOM node → skip silently
- Do NOT use innerHTML to re-render the entire #real-area on patch
