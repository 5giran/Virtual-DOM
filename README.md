# Virtual DOM / Diff / Patch Playground

브라우저의 실제 DOM을 Virtual DOM 트리로 바꾸고, 이전 상태와 다음 상태의 차이를 계산한 뒤 실제 DOM에 필요한 부분만 반영하는 바닐라 JavaScript 프로젝트입니다.

이번 정리는 "재사용성 극대화"보다 "처음 보는 팀원이 빠르게 읽고 이해할 수 있는 구조"를 우선했습니다.  
그래서 파일 수를 줄이고, `main -> ui -> core -> state` 흐름으로 읽을 수 있게 다시 묶었습니다.

## 프로젝트 구조

```text
virtualDOM/
├── public/
│   ├── index.html
│   └── tests.html
├── styles/
│   └── main.css
├── src/
│   ├── main.js
│   ├── sampleMarkup.js
│   ├── core/
│   │   ├── README.md
│   │   ├── vdom.js
│   │   ├── diff.js
│   │   └── patch.js
│   ├── state/
│   │   ├── README.md
│   │   └── store.js
│   └── ui/
│       ├── README.md
│       └── appUi.js
├── tests/
│   ├── node-logic-tests.js
│   └── runTests.js
└── package.json
```

## 폴더 / 파일 역할

- `src/main.js`
  앱 시작점입니다. Patch / Undo / Redo, 테스트 영역 편집, 전체 흐름 연결을 담당합니다.

- `src/sampleMarkup.js`
  데모 시작 시 사용할 기본 HTML입니다.

- `src/core/`
  Virtual DOM 생성, diff, patch 같은 핵심 알고리즘을 둡니다.

- `src/core/vdom.js`
  DOM -> VDOM, VDOM -> DOM, HTML 직렬화, clone, sanitize를 한 파일에 모았습니다.

- `src/core/diff.js`
  두 Virtual DOM을 비교해서 변경 목록을 만듭니다.

- `src/core/patch.js`
  이전/다음 Virtual DOM을 바탕으로 실제 DOM을 부분 갱신합니다.

- `src/state/store.js`
  현재 상태, history, undo/redo, 마지막 diff 결과를 관리합니다.

- `src/ui/appUi.js`
  화면에 필요한 DOM 요소 조회, 로그 렌더링, HTML 비교 패널, history 표시를 담당합니다.

## 추천 읽기 순서

처음 보는 팀원 기준으로는 아래 순서가 가장 이해하기 쉽습니다.

1. `src/main.js`
2. `src/ui/appUi.js`
3. `src/core/vdom.js`
4. `src/core/diff.js`
5. `src/core/patch.js`
6. `src/state/store.js`
7. `src/sampleMarkup.js`

핵심은 먼저 "전체 흐름"을 보고, 그 다음 "화면 연결", 마지막에 "알고리즘 세부"로 내려가는 것입니다.

## 핵심 구현 흐름

### 1. 초기 로딩

- `sampleMarkup.js`의 샘플 HTML을 실제 영역에 넣습니다.
- 실제 DOM을 `domToVdom()`로 읽어 초기 Virtual DOM을 만듭니다.
- 그 Virtual DOM으로 테스트 영역도 렌더링합니다.

### 2. 테스트 영역 수정

- 사용자는 테스트 영역 안의 수정 버튼으로 텍스트, 색상, 태그, 순서, 추가/삭제를 직접 바꿉니다.
- 이 시점에는 실제 영역은 그대로이고, 테스트 영역만 바뀝니다.

### 3. Patch

- `Patch` 버튼을 누르면 현재 테스트 영역 DOM을 다시 `domToVdom()`로 변환합니다.
- 이전 Virtual DOM과 새 Virtual DOM을 `diffTrees()`로 비교합니다.
- `patchDom()`으로 변경된 부분만 실제 영역에 반영합니다.

### 4. History

- Patch가 완료되면 새 Virtual DOM이 history에 저장됩니다.
- `뒤로가기 / 앞으로가기`를 누르면 저장된 Virtual DOM 상태로 이동합니다.
- 이때 실제 영역과 테스트 영역이 함께 바뀝니다.

## 왜 이렇게 다시 묶었는가

이전 구조는 관심사 분리는 잘 되어 있었지만, 한 함수 흐름을 따라가려면 import를 여러 단계 타고 들어가야 했습니다.  
이번 구조는 아래 기준으로 다시 정리했습니다.

- `core`: 알고리즘만 보기
- `ui`: 화면과 표시 로직만 보기
- `state`: history / store만 보기
- `main.js`: 전체 흐름만 보기

즉, "깔끔한 분리"보다 "읽기 쉬운 분리"를 우선했습니다.

## 실행 방법

정적 파일 서버로 프로젝트 루트를 열면 됩니다.

```bash
python3 -m http.server 8000
```

- 메인 데모: `http://localhost:8000/public/index.html`
- 테스트 페이지: `http://localhost:8000/public/tests.html`

Node 기반 로직 테스트:

```bash
npm run test:logic
```

## 테스트 체크리스트

- 텍스트 변경이 실제 DOM에 반영되는지
- class / 속성 변경이 반영되는지
- 태그 교체가 되는지
- `data-key`가 있는 리스트 순서 변경이 감지되는지
- 항목 추가/삭제가 반영되는지
- undo / redo 시 실제 영역과 테스트 영역이 함께 이동하는지

## 발표 때 설명하기 좋은 포인트

- 실제 DOM은 직접 많이 건드릴수록 layout / paint 비용이 커질 수 있습니다.
- Virtual DOM은 메모리 안에서 먼저 비교하고, 실제 DOM에는 필요한 부분만 반영합니다.
- 이 프로젝트는 `DOM -> VDOM -> Diff -> Patch -> History` 흐름을 한 화면에서 확인할 수 있게 만든 구현 결과물입니다.
