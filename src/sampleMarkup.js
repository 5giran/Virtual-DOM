/**
 * 역할:
 * - 데모 시작 화면에 사용할 초기 샘플 HTML을 보관합니다.
 *
 * 이 파일을 읽어야 하는 경우:
 * - 테스트 영역에서 어떤 요소를 수정하게 되는지 확인하고 싶을 때
 * - 발표용 기본 샘플 마크업을 바꾸고 싶을 때
 *
 * 관련 파일:
 * - main.js: 앱 시작 시 이 HTML을 Actual/Test 영역의 최초 상태로 사용합니다.
 */

export const sampleMarkup = `
<section class="sample-shell theme-blue">
  <header class="sample-hero">
    <p class="sample-label">Diff Cases</p>
    <h2 data-role="title">Patch only the changed nodes</h2>
    <p data-role="description">편집 모드를 켜고 텍스트를 직접 수정한 뒤 Patch를 눌러보세요.</p>
  </header>

  <ul class="sample-list">
    <li data-key="alpha">
      <strong class="sample-key">alpha</strong>
      <span class="sample-value" data-role="alpha-text">텍스트 변경 대상</span>
    </li>
    <li data-key="beta">
      <strong class="sample-key">beta</strong>
      <span class="sample-value">순서 변경 대상</span>
    </li>
    <li data-key="gamma">
      <strong class="sample-key">gamma</strong>
      <span class="sample-value">추가/삭제 기준 항목</span>
    </li>
  </ul>

  <div class="sample-row">
    <span class="sample-tag" data-role="theme-tag">theme-blue</span>
    <button type="button" class="sample-button" data-role="replace-target">button</button>
  </div>
</section>
`.trim();
