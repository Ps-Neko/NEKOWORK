/**
 * Wedge header — first-frame wedge line (above the fold).
 * design doc Path 1 의 핵심: 1초 이내 가시.
 */

export function renderWedge(): string {
  return `
    <header class="wedge" aria-labelledby="wedge-title" role="banner">
      <h1 id="wedge-title" class="wedge__title" lang="ko">
        LLM 의견은 verdict 가 아니다.
      </h1>
      <p class="wedge__sub" lang="en">
        LLM reviews give opinions. NEKOWORK ships evidence.
      </p>
    </header>
  `;
}
