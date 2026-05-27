/**
 * Hero: fixture-independent first frame for the public demo.
 * The rest of the page supplies fixture-specific evidence.
 */

export function renderHero(): string {
  return `
    <header class="hero" role="banner">
      <div class="hero__inner">
        <div class="hero__copy">
          <p class="hero__eyebrow" lang="ko">sample-pr-001 · AI 리뷰는 통과, 규칙 검사는 차단</p>
          <h1 class="hero__title" lang="ko">AI가 괜찮다던 코드,<br/>NEKOWORK는 병합 전에<br/>막았습니다.</h1>
          <p class="hero__sub" lang="ko">
            NEKOWORK는 AI 의견만 믿지 않습니다. 변경된 줄, 규칙, 증거 파일을 함께 확인해 위험한 PR이 바로 합쳐지지 않게 합니다.
          </p>
          <div class="hero__actions" aria-label="데모 주요 섹션 이동">
            <a class="hero__action hero__action--primary" href="#evidence-focus">차단 이유 보기</a>
            <a class="hero__action" href="#stations">검증 단계 보기</a>
          </div>
        </div>

        <div class="hero__panel" aria-label="AI만 사용한 흐름과 NEKOWORK를 사용한 흐름 비교">
          <div class="hero__toggle" role="group" aria-label="NEKOWORK 적용 전후 비교">
            <button type="button" class="hero__tg hero__tg--active" id="hero-tg-off" aria-pressed="true">AI만 믿었을 때</button>
            <button type="button" class="hero__tg" id="hero-tg-on" aria-pressed="false">NEKOWORK 사용</button>
          </div>

          <div class="hero__state" id="hero-state-off">
            <p class="hero__state-title">AI 리뷰 결과</p>
            <div class="hero__flow" role="list" aria-label="AI만 사용한 흐름: 코드 변경, AI LGTM, 병합, 배포">
              <span class="hero__bx" role="listitem">코드 변경</span>
              <span class="hero__ar" aria-hidden="true">→</span>
              <span class="hero__bx hero__bx--ai" role="listitem">AI LGTM</span>
              <span class="hero__ar" aria-hidden="true">→</span>
              <span class="hero__bx" role="listitem">병합</span>
              <span class="hero__ar" aria-hidden="true">→</span>
              <span class="hero__bx hero__bx--ship" role="listitem">배포</span>
            </div>
            <p class="hero__cap hero__cap--bad">위험 신호: 하드코딩된 JWT fallback이 그대로 지나갈 수 있습니다.</p>
          </div>

          <div class="hero__state hero__state--hidden" id="hero-state-on">
            <p class="hero__state-title">NEKOWORK 판정</p>
            <div class="hero__flow" role="list" aria-label="NEKOWORK 적용 흐름: 코드 변경, 규칙 검사, 차단, 사람 승인">
              <span class="hero__bx" role="listitem">코드 변경</span>
              <span class="hero__ar" aria-hidden="true">→</span>
              <span class="hero__bx hero__bx--scan" role="listitem">규칙 검사</span>
              <span class="hero__ar" aria-hidden="true">→</span>
              <span class="hero__bx hero__bx--neko" role="listitem">BLOCK</span>
              <span class="hero__ar" aria-hidden="true">→</span>
              <span class="hero__bx hero__bx--human" role="listitem">사람 승인</span>
            </div>
            <p class="hero__cap hero__cap--good">같은 코드라도 증거 기반 규칙이 위험을 찾으면 병합을 멈춥니다.</p>
          </div>

          <dl class="hero__facts" aria-label="이번 샘플 PR의 핵심 판정">
            <div>
              <dt>문제 줄</dt>
              <dd><code>src/auth.js:3</code></dd>
            </div>
            <div>
              <dt>규칙</dt>
              <dd><code>hardcoded-credential-fallback</code></dd>
            </div>
            <div>
              <dt>결론</dt>
              <dd><strong>apply.allowed = false</strong></dd>
            </div>
          </dl>
        </div>
      </div>
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
