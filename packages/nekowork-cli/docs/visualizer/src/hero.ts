/**
 * Hero — 워크플로우 Before/After 토글 (above the fold).
 * design doc: 20260525-viz-hero-workflow-rebuild.
 * 개인 개발자 흐름(내 코드→PR→AI LGTM→머지→배포)의 "검증 공백" →
 * NEKOWORK 켜면 BLOCK 이 끼어든다. 이 프로젝트의 첫 클라이언트 인터랙션.
 *
 * hero 카피/흐름은 fixture-독립 narrative 라 인자를 받지 않는다
 * (verdict 별 분기는 ②③④ 섹션이 담당).
 */

export function renderHero(): string {
  return `
    <header class="hero" role="banner">
      <p class="hero__eyebrow" lang="ko">AI가 코드를 쏟아내는 시대 — 검증만 사람 손에 남았다</p>
      <h1 class="hero__title" lang="ko">내 AI가 짠 코드를,<br/>내 AI가 &ldquo;괜찮다&rdquo;고 통과시켰다.</h1>
      <p class="hero__sub" lang="ko">사람이 진짜 본 적은 없는데, 그대로 배포된다.</p>

      <div class="hero__toggle" role="group" aria-label="NEKOWORK 적용 전후 비교">
        <button type="button" class="hero__tg hero__tg--active" id="hero-tg-off" aria-pressed="true">NEKOWORK 없이 (지금)</button>
        <button type="button" class="hero__tg" id="hero-tg-on" aria-pressed="false">NEKOWORK 켜기</button>
      </div>

      <div class="hero__state" id="hero-state-off">
        <div class="hero__flow" role="list" aria-label="NEKOWORK 없는 현재 흐름: 내 코드, PR, AI LGTM, 머지, 배포">
          <span class="hero__bx" role="listitem">내 코드</span>
          <span class="hero__ar" aria-hidden="true">→</span>
          <span class="hero__bx" role="listitem">PR</span>
          <span class="hero__ar" aria-hidden="true">→</span>
          <span class="hero__bx hero__bx--ai" role="listitem">AI ✓ LGTM</span>
          <span class="hero__ar" aria-hidden="true">→</span>
          <span class="hero__bx" role="listitem">머지</span>
          <span class="hero__ar" aria-hidden="true">→</span>
          <span class="hero__bx hero__bx--ship" role="listitem">🚢 배포</span>
        </div>
        <p class="hero__cap hero__cap--bad">🔴 검증 0인 채로 세상에 나간다.</p>
      </div>

      <div class="hero__state hero__state--hidden" id="hero-state-on">
        <div class="hero__flow" role="list" aria-label="NEKOWORK 적용 흐름: 내 코드, AI LGTM, NEKOWORK BLOCK, 사람 결정">
          <span class="hero__bx" role="listitem">내 코드</span>
          <span class="hero__ar" aria-hidden="true">→</span>
          <span class="hero__bx hero__bx--ai" role="listitem">AI ✓ LGTM</span>
          <span class="hero__ar" aria-hidden="true">→</span>
          <span class="hero__bx hero__bx--neko" role="listitem">⚡ NEKOWORK ✗ BLOCK</span>
          <span class="hero__ar" aria-hidden="true">→</span>
          <span class="hero__bx hero__bx--human" role="listitem">사람 결정</span>
        </div>
        <p class="hero__cap hero__cap--good">✓ 같은 코드인데 막혔다 — 의견이 아니라 규칙으로 판정한다.</p>
      </div>

      <p class="hero__scrollhint">↓ 왜 막았는지 보기</p>
    </header>
  `;
}

export function initHeroToggle(root: ParentNode = document): void {
  const off = root.querySelector<HTMLElement>('#hero-state-off');
  const on = root.querySelector<HTMLElement>('#hero-state-on');
  const bOff = root.querySelector<HTMLButtonElement>('#hero-tg-off');
  const bOn = root.querySelector<HTMLButtonElement>('#hero-tg-on');
  if (!off || !on || !bOff || !bOn) return;

  const set = (mode: 'off' | 'on'): void => {
    const isOn = mode === 'on';
    on.classList.toggle('hero__state--hidden', !isOn);
    off.classList.toggle('hero__state--hidden', isOn);
    bOn.classList.toggle('hero__tg--active', isOn);
    bOff.classList.toggle('hero__tg--active', !isOn);
    bOn.setAttribute('aria-pressed', String(isOn));
    bOff.setAttribute('aria-pressed', String(!isOn));
  };

  bOff.addEventListener('click', () => set('off'));
  bOn.addEventListener('click', () => set('on'));
}
