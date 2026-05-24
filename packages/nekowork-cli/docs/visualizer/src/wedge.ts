/**
 * Wedge header — first-frame wedge line (above the fold).
 * design doc Path 1 의 핵심: 1초 이내 가시.
 */

export function renderWedge(): string {
  return `
    <header class="wedge" aria-labelledby="wedge-title" role="banner">
      <h1 id="wedge-title" class="wedge__title" lang="ko">
        AI 의견은 판정이 아니다.
      </h1>
      <p class="wedge__plain" lang="ko">
        AI가 짠 코드를, AI가 “괜찮다”고 통과시켰다. 그 코드, 진짜로 본 사람 있나요?
      </p>
      <p class="wedge__sub" lang="ko">
        NEKOWORK는 의견이 아니라 규칙으로 막습니다.
      </p>
    </header>
  `;
}
