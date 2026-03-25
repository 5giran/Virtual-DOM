# Virtual DOM Diff/Patch Playground

## 프로젝트 소개

이 프로젝트는 Virtual DOM의 핵심 개념인

- DOM -> VDOM 변환
- 이전 상태와 다음 상태 비교(diff)
- 변경된 부분만 실제 DOM에 반영(patch)
- 상태 저장과 history 관리

를 한 화면에서 확인할 수 있도록 만든 playground입니다.

사용자는 Test DOM 또는 HTML 편집기를 통해 내용을 수정할 수 있고,  
Patch 버튼을 누르면 `currentVdom`과 `draftVdom`을 비교하여  
변경된 부분만 Actual DOM에 반영합니다.

## 핵심 아이디어

이 프로젝트는 실제 DOM을 직접 계속 수정하는 대신,  
메모리 안에서 Virtual DOM 상태를 관리한 뒤,  
두 상태의 차이를 계산해서 필요한 부분만 실제 DOM에 반영합니다.

즉, 전체를 다시 그리는 것이 아니라  
"무엇이 바뀌었는지 먼저 계산하고, 그 부분만 업데이트"하는 흐름을 구현했습니다.

## 동작 흐름

<img width="1408" height="768" alt="image_6cd0b7f8" src="https://github.com/user-attachments/assets/3bef73ee-6527-4fa7-abcb-addc8cca18a1" />


## 실행 방법

```bash
python3 -m http.server 8000
```


## 주요 기능

- 텍스트 수정
- 속성 변경
- 태그 교체
- 리스트 항목 추가 / 삭제 / 이동
- undo / redo
- HTML 직접 편집 후 patch
- 잘못된 HTML 입력 검증
- 변경 로그 및 HTML 비교 패널 제공

## 테스트 및 엣지케이스

이 프로젝트는 정상 동작뿐 아니라 여러 엣지케이스도 테스트합니다.

- 텍스트 + 속성 동시 변경
- keyed list 이동
- 태그 교체
- 특수문자 escape
- sanitize 처리
- textarea 공백 보존
- 중복 key로 인한 불안정성 확인
- undo / redo 이후 상태 동기화
