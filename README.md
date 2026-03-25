# Virtual DOM / Diff / Patch Playground

브라우저의 실제 DOM을 Virtual DOM 트리로 변환하고, 이전 상태와 다음 상태의 차이를 계산한 뒤 실제 DOM에 필요한 부분만 반영하는 과정을 시각적으로 확인하는 바닐라 JavaScript 프로젝트입니다.

## 폴더 구조

```text
virtualDOM/
├── public/
│   ├── index.html
│   └── tests.html
├── styles/
│   └── main.css
├── src/
│   ├── main.js
│   ├── core/
│   │   ├── diff/
│   │   │   ├── changeTypes.js
│   │   │   └── diffTrees.js
│   │   ├── history/
│   │   │   └── createHistory.js
│   │   ├── patch/
│   │   │   └── reconcileDom.js
│   │   └── vdom/
│   │       ├── cloneVdom.js
│   │       ├── createDomFromVdom.js
│   │       ├── domToVdom.js
│   │       └── serializeVdom.js
│   ├── samples/
│   │   └── sampleMarkup.js
│   ├── state/
│   │   └── createStore.js
│   ├── ui/
│   │   ├── elements.js
│   │   ├── observeDomChanges.js
│   │   └── renderApp.js
│   └── utils/
│       ├── html.js
│       └── nodeKey.js
└── tests/
    └── runTests.js
```

## 왜 이렇게 나눴는가

- `core/vdom`
  브라우저 DOM <-> Virtual DOM 변환과 직렬화를 담당합니다.
- `core/diff`
  이전 트리와 다음 트리의 차이를 계산하는 순수 함수만 둡니다.
- `core/patch`
  diff 결과와 두 VDOM 상태를 바탕으로 실제 DOM을 부분 갱신합니다.
- `core/history`
  undo / redo를 위한 상태 이력을 담당합니다.
- `state`
  현재 선택된 VDOM, 마지막 diff 결과, mutation 통계를 묶어서 관리합니다.
- `ui`
  DOM query, 상태 렌더링, MutationObserver 연결처럼 화면과 직접 맞닿는 코드를 둡니다.
- `samples`
  데모용 초기 HTML 데이터입니다.
- `tests`
  발표 전에 브라우저에서 바로 돌려볼 수 있는 검증 코드입니다.

핵심은 `알고리즘`, `실제 DOM 조작`, `화면 표현`이 서로 섞이지 않게 하는 것입니다.

## 핵심 로직

### 1. DOM -> Virtual DOM

- `src/core/vdom/domToVdom.js`
- 실제 브라우저 DOM을 순회하며 element / text 노드를 JS 객체 트리로 변환합니다.
- `contenteditable`, `spellcheck` 같은 편집기용 속성은 제외합니다.
- `input`, `textarea`, `select`, `details`처럼 속성과 실제 상태가 달라질 수 있는 요소는 현재 상태를 별도로 읽습니다.

### 2. Diff 알고리즘

- `src/core/diff/diffTrees.js`
- 두 Virtual DOM을 재귀적으로 비교해 변경 목록을 만듭니다.
- 핵심 케이스
  - 노드 추가
  - 노드 제거
  - 노드 교체
  - 텍스트 변경
  - 속성 추가/삭제/변경
- 리스트 항목에 `data-key`가 있으면 reorder를 감지해 `MOVE_CHILD`도 기록합니다.

### 3. Patch 알고리즘

- `src/core/patch/reconcileDom.js`
- 이전 VDOM과 다음 VDOM을 바탕으로 실제 DOM을 직접 재조정합니다.
- 같은 태그면 속성과 자식만 갱신하고, 타입이나 태그가 바뀌면 해당 노드만 교체합니다.
- keyed child가 있으면 가능한 한 기존 DOM 노드를 재사용하면서 위치만 이동합니다.

### 4. History

- `src/core/history/createHistory.js`
- Patch가 성공한 시점의 VDOM만 저장합니다.
- 뒤로가기 / 앞으로가기는 저장된 VDOM을 기준으로 실제 영역과 테스트 영역을 함께 갱신합니다.

## 실행 방법

정적 파일 서버로 프로젝트 루트를 열면 됩니다.

```bash
python3 -m http.server 8000
```

- 메인 데모: `http://localhost:8000/public/index.html`
- 테스트 페이지: `http://localhost:8000/public/tests.html`

## 테스트 체크리스트

- 텍스트만 수정했을 때 실제 DOM mutation 개수가 과도하게 늘어나지 않는지 확인
- `class`, `title`, `data-*` 같은 속성 변경이 반영되는지 확인
- 태그를 `p -> div`, `ul -> ol`처럼 바꿨을 때 노드 교체가 되는지 확인
- `data-key`가 있는 리스트 순서를 바꿨을 때 move가 감지되는지 확인
- 뒤로가기 / 앞으로가기 시 실제 영역과 테스트 영역이 동시에 바뀌는지 확인

## 발표용 포인트

- 실제 DOM은 변경 시 layout / paint 비용이 커서 직접 많이 건드릴수록 비싸다.
- Virtual DOM은 메모리 상의 비교를 먼저 수행하고, 실제 DOM에는 필요한 부분만 반영한다.
- MutationObserver를 통해 Patch 이후 실제로 어떤 DOM 변경이 발생했는지 수치로 확인할 수 있다.
- 이 프로젝트는 `DOM -> VDOM -> Diff -> Patch -> History` 흐름을 하나의 화면에서 보여준다.
