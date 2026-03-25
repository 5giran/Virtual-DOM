# Virtual DOM Playground

브라우저에서 실제 DOM을 읽어 Virtual DOM으로 바꾸고, 두 Virtual DOM 사이의 차이를 계산해서 변경된 부분만 실제 DOM에 반영하는 데모입니다. 외부 라이브러리 없이 `HTML`, `CSS`, `Vanilla JavaScript`만 사용했습니다.

## 실행 방법

1. 저장소를 내려받거나 현재 작업 폴더를 엽니다.
2. [index.html](C:/Users/yoonj/jungle/Virtual-DOM/index.html) 파일을 브라우저에서 직접 엽니다.
3. 오른쪽 테스트 영역의 HTML을 수정한 뒤 `Patch` 버튼을 눌러 동작을 확인합니다.

## 파일 구성

- [index.html](C:/Users/yoonj/jungle/Virtual-DOM/index.html): 데모 UI와 샘플 DOM 템플릿
- [styles.css](C:/Users/yoonj/jungle/Virtual-DOM/styles.css): 레이아웃과 시각 디자인
- [script.js](C:/Users/yoonj/jungle/Virtual-DOM/script.js): Virtual DOM, Diff, Patch, History, MutationObserver 로직

## 구현된 핵심 기능

### 1. 실제 DOM -> Virtual DOM 변환

앱이 로드되면 샘플 HTML을 실제 DOM으로 렌더링한 뒤 [`domToVNode`](C:/Users/yoonj/jungle/Virtual-DOM/script.js) 함수가 브라우저의 DOM 정보를 읽어 Virtual DOM 트리로 바꿉니다.

```js
{
  kind: "element",
  tagName: "section",
  attributes: { class: "demo-card", "data-theme": "forest" },
  children: [
    {
      kind: "element",
      tagName: "header",
      attributes: { class: "demo-card__header" },
      children: [...]
    }
  ]
}
```

구현 규칙은 다음과 같습니다.

- `Element` 노드는 `tagName`, `attributes`, `children`으로 저장합니다.
- 의미 있는 `Text` 노드는 `{ kind: "text", text }`로 저장합니다.
- 공백만 있는 텍스트 노드는 무시합니다.
- `comment`, `script`, `style`은 지원 범위에서 제외합니다.

### 2. Diff 알고리즘

[`diffVTree`](C:/Users/yoonj/jungle/Virtual-DOM/script.js)는 이전 Virtual DOM과 새 Virtual DOM을 비교해 path 기반 patch 목록을 만듭니다. 자식 노드 비교는 index 기반으로 처리합니다.

이번 구현에서 다루는 5가지 핵심 케이스는 아래와 같습니다.

1. `CREATE`: 이전에는 없던 노드가 생긴 경우
2. `REMOVE`: 있던 노드가 사라진 경우
3. `REPLACE`: 노드 타입 또는 태그가 달라진 경우
4. `TEXT`: 텍스트 내용만 바뀐 경우
5. `PROPS`: 속성 추가, 수정, 삭제가 발생한 경우

예를 들어 `span`을 `strong`으로 바꾸면 태그가 달라지므로 `REPLACE` patch가 생성됩니다. `class` 값만 바뀌면 `PROPS`, 문구만 바뀌면 `TEXT` patch가 생성됩니다.

### 3. 실제 DOM Patch 반영

[`applyPatches`](C:/Users/yoonj/jungle/Virtual-DOM/script.js)는 diff 결과를 실제 DOM에 반영합니다. patch 적용 순서는 다음과 같습니다.

1. `REMOVE`: 깊은 path, 큰 index부터 제거
2. `REPLACE`, `TEXT`, `PROPS`: 기존 노드 수정
3. `CREATE`: 얕은 path, 작은 index부터 추가

이 순서를 쓰는 이유는 자식 노드 index가 흔들리는 것을 막기 위해서입니다. 예를 들어 앞쪽 자식을 먼저 삭제하면 뒤쪽 자식들의 위치가 당겨져서 이후 patch가 잘못된 노드를 가리킬 수 있습니다.

### 4. State History와 Undo / Redo

매번 `Patch`가 성공할 때마다 `{ html, vnode }` 형태의 snapshot을 history에 저장합니다. 단, diff 결과가 없으면 history를 늘리지 않습니다.

- `뒤로가기`: 이전 snapshot으로 이동
- `앞으로가기`: 다음 snapshot으로 이동
- history 이동 시 실제 영역과 테스트 영역을 같이 복원

복원은 diff를 다시 쓰지 않고 snapshot 전체를 다시 렌더링하는 방식으로 처리합니다. 이렇게 하면 상태 이동 로직이 단순하고 예측 가능해집니다.

### 5. MutationObserver 로그

브라우저의 `MutationObserver`를 실제 영역 root에 붙여서 다음 변화를 기록합니다.

- `childList`: 노드 추가/삭제
- `attributes`: 속성 변경
- `characterData`: 텍스트 변경

화면 아래 별도 로그 패널은 제거했고, 현재는 브라우저 콘솔에서 observer 로그를 확인할 수 있습니다. 실제 patch 계산은 `MutationObserver`가 아니라 Virtual DOM diff 결과를 기준으로 진행합니다.

## 브라우저에서 DOM을 다루는 방법

### `document`

`document`는 현재 페이지의 DOM 트리에 접근하는 시작점입니다.

- `getElementById`, `querySelector`로 특정 노드를 찾을 수 있습니다.
- `createElement`, `createTextNode`로 새 DOM 노드를 만들 수 있습니다.
- `replaceChildren`, `append`, `insertBefore`, `remove`로 화면 구조를 바꿀 수 있습니다.

이번 프로젝트에서 `document`는 다음 역할을 맡습니다.

- 샘플 DOM을 실제로 렌더링
- Virtual DOM을 실제 DOM 노드로 생성
- patch 결과를 실제 DOM에 반영

### `window`

`window`는 브라우저 환경 전체를 의미합니다. `DOMParser`, `MutationObserver`, `Node` 같은 브라우저 API들도 결국 이 환경 위에서 동작합니다.

이번 프로젝트에서 `window` 레벨 브라우저 기능을 통해 얻는 이점은 다음과 같습니다.

- `DOMParser`로 입력 HTML을 검증할 수 있음
- `MutationObserver`로 실제 DOM 변화 기록을 남길 수 있음
- `Node.ELEMENT_NODE`, `Node.TEXT_NODE`로 노드 타입을 안전하게 구분할 수 있음

## 실제 DOM이 느린 이유

실제 DOM이 느린 이유는 자바스크립트 객체라서가 아니라, 화면 반영 비용이 크기 때문입니다.

### Reflow

레이아웃을 다시 계산하는 과정입니다. DOM 구조나 크기, 위치가 바뀌면 브라우저는 어떤 요소가 어디에 배치되어야 하는지 다시 계산해야 합니다.

예시:

- 노드 추가/삭제
- 글자 수 증가로 인한 박스 크기 변화
- `display`, `width`, `margin` 같은 속성 변경

### Repaint

레이아웃 위치는 그대로인데 색, 배경, 텍스트 등 그리는 결과가 달라져 다시 칠하는 과정입니다.

예시:

- `color`, `background`, `border-color` 변경
- 텍스트 내용 변경

실제 DOM을 자주, 많이 건드릴수록 브라우저는 reflow/repaint를 더 자주 수행할 수 있습니다. 그래서 React 같은 라이브러리는 "무엇이 바뀌었는지"를 메모리 상의 Virtual DOM에서 먼저 계산하고, 필요한 최소 DOM 조작만 실제로 수행하려고 합니다.

## Virtual DOM이 필요한 이유

Virtual DOM은 실제 DOM과 비슷한 구조를 가진 가벼운 자바스크립트 객체 트리입니다.

필요한 이유는 다음과 같습니다.

- 실제 DOM을 직접 전부 다시 그리지 않고 비교 계산을 메모리에서 먼저 할 수 있습니다.
- 상태 변경 전/후 구조를 비교하기 쉬워집니다.
- 변경된 부분만 실제 DOM에 반영하도록 최적화할 수 있습니다.

이번 프로젝트에서는 Virtual DOM을 직접 구현해서, React가 내부적으로 처리하는 핵심 아이디어를 눈으로 볼 수 있게 만들었습니다.

## React에서 실제 DOM을 바꿀 때의 흐름

React의 내부 구현은 훨씬 복잡하지만, 큰 흐름은 아래처럼 이해할 수 있습니다.

1. 상태(state) 변경이 발생한다.
2. 새로운 Virtual DOM(React Element Tree)이 만들어진다.
3. 이전 Virtual DOM과 새로운 Virtual DOM을 비교한다.
4. 무엇이 달라졌는지 계산한다.
5. 실제 DOM에는 필요한 부분만 commit 한다.

이 프로젝트는 그 과정을 아주 단순화한 버전입니다.

- 상태 변경: 테스트 영역의 HTML 편집
- 새 Virtual DOM 생성: `parseEditorHtml`
- 비교: `diffVTree`
- 반영: `applyPatches`
- 이동: history snapshot 복원

실제 React는 여기에 Fiber, scheduling, batching, keyed diff, component tree, hooks, event system 같은 요소가 더해집니다. 하지만 "가상 트리를 비교해서 실제 DOM 최소 변경만 반영한다"는 핵심 감각은 이 프로젝트와 같습니다.

## 검증 시나리오

아래 시나리오로 각 diff 케이스를 직접 확인할 수 있습니다.

### `TEXT`

`Patch 버튼은 변경된 DOM 조각만 실제 영역에 반영합니다.` 문장을 바꿔 봅니다.

### `PROPS`

두 번째 `li`의 `class="accent"` 값을 지우거나 다른 값으로 바꿔 봅니다.

### `CREATE`

`ul` 안에 새 `li`를 하나 추가합니다.

### `REMOVE`

기존 `li` 하나를 삭제합니다.

### `REPLACE`

`footer` 안의 `<span>`을 `<strong>`으로 바꿉니다.

### Invalid HTML

닫는 태그를 일부러 빼거나, 속성값 따옴표를 지우면 validation 에러가 뜨고 patch/history/실제 DOM은 유지됩니다.

## 제한 사항

- single-root, well-formed HTML subset만 지원합니다.
- 속성값은 따옴표로 감싸야 합니다.
- `comment`, `script`, `style`, keyed reorder 최적화는 지원하지 않습니다.
- child reorder는 별도 최적화 없이 remove/create 조합처럼 보일 수 있습니다.

## 핵심 함수 요약

- [`domToVNode`](C:/Users/yoonj/jungle/Virtual-DOM/script.js): 실제 DOM을 Virtual DOM으로 변환
- [`createDomFromVNode`](C:/Users/yoonj/jungle/Virtual-DOM/script.js): Virtual DOM을 실제 DOM으로 생성
- [`serializeVNode`](C:/Users/yoonj/jungle/Virtual-DOM/script.js): Virtual DOM을 편집기용 HTML 문자열로 직렬화
- [`parseEditorHtml`](C:/Users/yoonj/jungle/Virtual-DOM/script.js): 편집기 HTML을 검증하고 새 Virtual DOM으로 변환
- [`diffVTree`](C:/Users/yoonj/jungle/Virtual-DOM/script.js): 이전/다음 Virtual DOM 비교
- [`applyPatches`](C:/Users/yoonj/jungle/Virtual-DOM/script.js): patch를 실제 DOM에 적용
- [`restoreSnapshot`](C:/Users/yoonj/jungle/Virtual-DOM/script.js): history snapshot 복원
