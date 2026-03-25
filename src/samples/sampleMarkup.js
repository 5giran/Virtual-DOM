export const sampleMarkup = `
<section class="sample-shell">
  <header class="sample-hero">
    <p class="eyebrow">Sample Scenario</p>
    <h2>Virtual DOM Launch Board</h2>
    <p>
      실제 DOM을 Virtual DOM으로 변환하고 diff 결과만 실제 영역에 patch 하는 흐름을
      확인할 수 있습니다.
    </p>
  </header>

  <div class="sample-grid">
    <article class="sample-note">
      <h3>검증 포인트</h3>
      <p>
        텍스트 변경, 속성 추가, 태그 교체, 리스트 항목 삽입/삭제, keyed reorder를 모두
        실험해 보세요.
      </p>
      <div class="pill-row">
        <span class="pill">Text</span>
        <span class="pill">Attributes</span>
        <span class="pill">Replace</span>
      </div>
    </article>

    <ul class="sample-list">
      <li data-key="alpha"><strong>alpha</strong> 문장을 수정해 보세요.</li>
      <li data-key="beta"><strong>beta</strong> 순서를 바꿔 keyed diff를 확인하세요.</li>
      <li data-key="gamma"><strong>gamma</strong> 새 항목을 추가해서 insert를 테스트하세요.</li>
    </ul>
  </div>

  <section class="sample-table">
    <table>
      <thead>
        <tr>
          <th>Layer</th>
          <th>Role</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Virtual DOM</td>
          <td>브라우저 DOM의 구조를 메모리 객체로 표현</td>
        </tr>
        <tr>
          <td>Diff</td>
          <td>이전 상태와 다음 상태를 비교</td>
        </tr>
        <tr>
          <td>Patch</td>
          <td>실제 DOM에 필요한 부분만 반영</td>
        </tr>
      </tbody>
    </table>
  </section>
</section>
`.trim();
