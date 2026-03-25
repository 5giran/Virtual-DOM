# src/state

역할:
- 현재 VDOM, history, undo/redo, 마지막 diff 결과와 mutation 수를 관리합니다.

이 폴더를 읽어야 하는 경우:
- Patch 이후 어떤 상태가 저장되는지 보고 싶을 때
- 뒤로가기 / 앞으로가기 로직을 이해하고 싶을 때

추천 읽기 순서:
1. `store.js`
2. `../main.js`
