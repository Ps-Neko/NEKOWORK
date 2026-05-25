# NEKOWORK Visualizer Hero 리빌드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** visualizer 의 정적 wedge 헤더를, 개인 개발자 워크플로우를 보여주는 Before/After 토글 hero 로 교체하고 기존 자산(충돌 비교·12단계·증거)은 그대로 잇는다.

**Architecture:** `src/wedge.ts` 를 `src/hero.ts` 로 대체. `renderHero()` 가 정적 마크업(eyebrow/타이틀/서브/토글/before·after 흐름도/스크롤힌트)을 반환하고, `initHeroToggle(root)` 가 토글 버튼에 클릭 핸들러를 바인딩한다(이 프로젝트의 첫 클라이언트 인터랙션). 나머지 섹션(conflict/stations/evidence)은 순서·내용 유지. PR summary 섹션은 제거하고 PR 식별 한 줄을 conflict 헤더로 흡수. **각 Task 종료 시 전체 a11y 스위트가 green** 이 되도록 구성.

**Tech Stack:** Vite 6 + TypeScript 5.7, Playwright + axe-core (a11y E2E), pnpm workspace (`@ps-neko/visualizer`). base path `/NEKOWORK/`, fixture `sample-pr-001`.

**Spec:** `docs/plans/design/20260525-viz-hero-workflow-rebuild-design.md`

**Branch:** `feat/viz-hero-workflow-rebuild` (harness 는 main 이 default → 작업 전 브랜치 생성)

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/hero.ts` | hero 마크업 + 토글 바인딩 | **신규** |
| `src/wedge.ts` | (구) 정적 wedge 헤더 | **삭제** |
| `src/renderer.ts` | 페이지 조립 | wedge→hero, PR summary 제거, conflict 헤더에 PR 흡수 |
| `src/main.ts` | 부트스트랩 | render 후 `initHeroToggle(root)` 호출 |
| `src/styles.css` | 스타일 | `.wedge*` 제거, `.hero*` + `.conflict__pr` 추가 |
| `tests/a11y.test.ts` | a11y/E2E | `.wedge` 테스트 → `.hero`, 토글 테스트 추가 |
| `scripts/gen-hero-gif.ts` | README GIF | `.wedge`→`.hero`, before/after 2프레임 캡처 |

**작업 디렉토리:** 모든 상대 경로는 `packages/nekowork-cli/docs/visualizer/` 기준. 명령은 monorepo 루트(`C:/Users/Mun/harness`)에서 `pnpm --filter @ps-neko/visualizer <script>` 로 실행.

**참고 — `tests/a11y.test.ts` 의 `.wedge` 직접 참조는 단 1건**(`first-frame wedge above-the-fold at 1280x720 (Path 1)` 테스트의 `.wedge` boundingBox). 이 1건을 Task 1 에서 `.hero` 로 교체한다.

---

## Task 0: 브랜치 생성

- [ ] **Step 1: 브랜치 생성**

Run:
```bash
git -C C:/Users/Mun/harness checkout -b feat/viz-hero-workflow-rebuild
```
Expected: `Switched to a new branch 'feat/viz-hero-workflow-rebuild'`

---

## Task 1: hero 교체 (hero.ts + 연결 + 스타일 + 테스트) — 종료 시 전체 green

wedge → hero 를 한 번에 끝낸다: 마크업·토글 JS·스타일·테스트를 모두 포함해 Task 종료 시 전체 a11y 스위트가 통과한다. (`wedge.ts` 파일 삭제와 `renderPrSummary` 제거는 미사용 상태로 남겨 Task 2·3 에서 정리.)

**Files:**
- Create: `src/hero.ts`
- Modify: `src/renderer.ts`, `src/main.ts`, `src/styles.css`
- Test: `tests/a11y.test.ts`

- [ ] **Step 1: a11y 테스트 수정 + 추가**

(1) 기존 테스트 `first-frame wedge above-the-fold at 1280x720 (Path 1)` 전체를 아래로 **교체**:

```typescript
  test('first-frame hero above-the-fold at 1280x720', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' });

    const title = await page.locator('.hero__title').boundingBox();
    expect(title, '.hero__title bounding box').not.toBeNull();
    if (!title) throw new Error('hero title missing');
    expect(title.y + title.height, 'hero title within viewport').toBeLessThanOrEqual(720);
  });
```

(2) `test.describe(...)` 블록 끝에 hero 토글 테스트 **추가**:

```typescript
  test('hero renders, toggles before/after, aria-pressed flips', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' });

    await expect(page.locator('.hero__title')).toContainText('내 AI가 짠 코드를');

    const btnOff = page.locator('#hero-tg-off');
    const btnOn = page.locator('#hero-tg-on');
    await expect(btnOff).toHaveAttribute('aria-pressed', 'true');
    await expect(btnOn).toHaveAttribute('aria-pressed', 'false');

    await expect(page.locator('#hero-state-on')).toBeHidden();
    await expect(page.locator('#hero-state-off')).toBeVisible();

    await btnOn.click();
    await expect(page.locator('#hero-state-on')).toBeVisible();
    await expect(page.locator('#hero-state-off')).toBeHidden();
    await expect(btnOn).toHaveAttribute('aria-pressed', 'true');
    await expect(btnOff).toHaveAttribute('aria-pressed', 'false');
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @ps-neko/visualizer test:a11y`
Expected: FAIL — `.hero__title` not found (timeout). 기존 wedge 테스트는 이미 교체됨.

- [ ] **Step 3: `src/hero.ts` 생성**

```typescript
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
```

- [ ] **Step 4: `src/renderer.ts` — wedge→hero 교체**

상단 import — 기존:
```typescript
import { renderWedge } from './wedge.js';
```
변경:
```typescript
import { renderHero } from './hero.js';
```

`render()` 안 — 기존:
```typescript
  root.innerHTML = `
    ${renderWedge()}
    <main class="layout" data-fixture-id="${escapeAttr(fixture.id)}">
```
변경 (`renderPrSummary` 줄은 Task 2 까지 그대로 둔다):
```typescript
  root.innerHTML = `
    ${renderHero()}
    <main class="layout" data-fixture-id="${escapeAttr(fixture.id)}">
```

- [ ] **Step 5: `src/main.ts` — 토글 바인딩**

기존:
```typescript
import './styles.css';
import { loadFixtures, selectFixture } from './fixtures.js';
import { render } from './renderer.js';
```
변경:
```typescript
import './styles.css';
import { loadFixtures, selectFixture } from './fixtures.js';
import { render } from './renderer.js';
import { initHeroToggle } from './hero.js';
```

기존 마지막 줄:
```typescript
render(root, fixture);
```
변경:
```typescript
render(root, fixture);
initHeroToggle(root);
```

- [ ] **Step 6: `src/styles.css` — hero 블록 추가**

기존 `/* --- Wedge (above the fold, design doc Path 1) --- */` 블록 **다음에** 추가(.wedge 규칙 제거는 Task 3):

```css
/* --- Hero (workflow Before/After toggle, above the fold) --- */

.hero {
  background: radial-gradient(120% 100% at 50% 0%, #15171f 0%, var(--bg) 60%);
  border-bottom: 1px solid var(--border);
  padding: 46px 20px 34px;
  text-align: center;
}

.hero__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: #ff8a8d;
  margin: 0;
}

.hero__title {
  font-size: clamp(26px, 5vw, 46px);
  font-weight: 800;
  line-height: 1.18;
  color: #fff;
  margin: 14px 0 0;
  letter-spacing: -0.01em;
}

.hero__sub {
  font-size: clamp(15px, 2.2vw, 20px);
  color: var(--text-muted);
  margin: 14px auto 0;
  font-weight: 600;
  max-width: 520px;
}

.hero__toggle {
  display: inline-flex;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  overflow: hidden;
  margin: 28px 0 22px;
}

.hero__tg {
  background: transparent;
  border: 0;
  color: var(--text-muted);
  padding: 11px 20px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.hero__tg--active {
  background: var(--neko-accent);
  color: #1a0708;
}

#hero-tg-off.hero__tg--active {
  background: #3a3f4b;
  color: #fff;
}

.hero__state--hidden {
  display: none;
}

.hero__flow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 24px 16px;
  min-height: 84px;
  max-width: 680px;
  margin: 0 auto;
}

.hero__bx {
  background: var(--surface-2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--advisor-fg);
  border-radius: 7px;
  padding: 8px 11px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.hero__bx--ai {
  background: rgba(111, 161, 255, 0.16);
  border-color: rgba(111, 161, 255, 0.55);
  color: #cfe0ff;
}

.hero__bx--ship {
  background: rgba(246, 183, 60, 0.16);
  border-color: rgba(246, 183, 60, 0.5);
  color: #ffe1a5;
}

.hero__bx--neko {
  background: var(--neko-accent);
  border-color: var(--neko-accent);
  color: #1a0708;
  font-weight: 800;
}

.hero__bx--human {
  background: rgba(56, 193, 114, 0.16);
  border-color: rgba(56, 193, 114, 0.5);
  color: #bcefd0;
}

.hero__ar {
  color: #7d8495;
  font-size: 12px;
}

.hero__cap {
  margin: 15px auto 0;
  font-size: 15px;
  font-weight: 700;
  max-width: 560px;
}

.hero__cap--bad {
  color: #ff8a8d;
}

.hero__cap--good {
  color: #bcefd0;
}

.hero__scrollhint {
  margin-top: 26px;
  color: var(--skip);
  font-size: 12px;
  font-weight: 600;
}
```

- [ ] **Step 7: 타입체크**

Run: `pnpm --filter @ps-neko/visualizer typecheck`
Expected: PASS, 0 errors.

- [ ] **Step 8: 전체 a11y 스위트 통과 확인**

Run: `pnpm --filter @ps-neko/visualizer test:a11y`
Expected: 전체 PASS — axe 0 violations, 12-station aria, 모바일 320px, first-frame hero above-the-fold, hero 토글, prefers-reduced-motion. (`wedge.ts` 파일과 `renderPrSummary` 는 미사용 상태로 남아 있지만 동작/테스트엔 영향 없음.)

- [ ] **Step 9: 커밋**

```bash
git -C C:/Users/Mun/harness add packages/nekowork-cli/docs/visualizer/src/hero.ts packages/nekowork-cli/docs/visualizer/src/renderer.ts packages/nekowork-cli/docs/visualizer/src/main.ts packages/nekowork-cli/docs/visualizer/src/styles.css packages/nekowork-cli/docs/visualizer/tests/a11y.test.ts
git -C C:/Users/Mun/harness commit -m "feat(visualizer): 워크플로우 Before/After 토글 hero (wedge 대체)"
```

---

## Task 2: PR summary 섹션 제거 + conflict 헤더로 PR 식별 흡수

**Files:**
- Modify: `src/renderer.ts`, `src/styles.css`
- Test: `tests/a11y.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/a11y.test.ts` 에 추가:

```typescript
  test('conflict section carries PR identity, no standalone pr-summary', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' });
    await expect(page.locator('.pr-summary')).toHaveCount(0);
    await expect(page.locator('.conflict__pr')).toHaveCount(1);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @ps-neko/visualizer test:a11y`
Expected: FAIL — `.pr-summary` count 1, `.conflict__pr` count 0.

- [ ] **Step 3: `src/renderer.ts` — `renderPrSummary` 호출/정의 제거**

`render()` 안에서 이 줄 삭제:
```typescript
      ${renderPrSummary(fixture)}
```
그리고 `function renderPrSummary(fixture: Fixture): string { ... }` 정의 전체를 삭제.

- [ ] **Step 4: `src/renderer.ts` — `renderConflictFrame` 헤더에 PR 식별 줄 추가**

기존:
```typescript
    <section class="conflict" aria-label="Claude advisor vs NEKOWORK rule comparison">
      <h2 class="conflict__title">같은 코드, 다른 결론</h2>
```
변경:
```typescript
    <section class="conflict" aria-label="Claude advisor vs NEKOWORK rule comparison">
      <p class="conflict__pr"><code>${escapeHtml(fixture.samplePr.pr_id)}</code> ${escapeHtml(fixture.samplePr.title)}</p>
      <h2 class="conflict__title">같은 코드, 다른 결론</h2>
```

- [ ] **Step 5: `src/styles.css` — pr-summary 제거, conflict__pr 추가**

`/* --- PR summary --- */` 주석부터 `.pr-summary__purpose { ... }` 끝까지 모든 `.pr-summary*` 규칙 삭제.

`.conflict__title` 규칙 **앞에** 추가:
```css
.conflict__pr {
  grid-column: 1 / -1;
  margin: 0 0 4px;
  font-family: ui-monospace, SFMono-Regular, 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--text-muted);
}

.conflict__pr code {
  color: var(--text);
}
```

- [ ] **Step 6: 타입체크 + 전체 a11y 통과**

Run: `pnpm --filter @ps-neko/visualizer typecheck`
Expected: PASS (`renderPrSummary` 미사용 잔재 없음).

Run: `pnpm --filter @ps-neko/visualizer test:a11y`
Expected: 전체 PASS (새 conflict PR 테스트 포함).

- [ ] **Step 7: 커밋**

```bash
git -C C:/Users/Mun/harness add packages/nekowork-cli/docs/visualizer/src/renderer.ts packages/nekowork-cli/docs/visualizer/src/styles.css packages/nekowork-cli/docs/visualizer/tests/a11y.test.ts
git -C C:/Users/Mun/harness commit -m "refactor(visualizer): PR summary 제거 + conflict 헤더로 PR 식별 흡수"
```

---

## Task 3: wedge.ts 삭제 + styles `.wedge*` 정리

**Files:**
- Delete: `src/wedge.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: `src/wedge.ts` 삭제**

```bash
git -C C:/Users/Mun/harness rm packages/nekowork-cli/docs/visualizer/src/wedge.ts
```

- [ ] **Step 2: `src/styles.css` 의 wedge 블록 제거**

`/* --- Wedge (above the fold, design doc Path 1) --- */` 주석부터 `.wedge__sub { ... }` 규칙 끝까지(`.wedge`, `.wedge__title`, `.wedge__plain`, `.wedge__sub` 4개 규칙 + 주석)를 통째로 삭제.

- [ ] **Step 3: 타입체크 — wedge import 잔재 없음**

Run: `pnpm --filter @ps-neko/visualizer typecheck`
Expected: PASS. `Cannot find module './wedge.js'` 류 에러 없음.

- [ ] **Step 4: 전체 a11y 통과**

Run: `pnpm --filter @ps-neko/visualizer test:a11y`
Expected: 전체 PASS (wedge 참조 0 — Task 1 에서 이미 hero 로 교체됨).

- [ ] **Step 5: 커밋**

```bash
git -C C:/Users/Mun/harness add packages/nekowork-cli/docs/visualizer/src/styles.css
git -C C:/Users/Mun/harness commit -m "refactor(visualizer): 미사용 wedge.ts + .wedge 스타일 제거"
```

---

## Task 4: 토글 키보드 접근성 회귀 테스트

토글 버튼은 `<button>` 이라 포커스/Enter/Space 가 기본 보장되지만, 회귀 방지로 명시 검증한다.

**Files:**
- Test: `tests/a11y.test.ts`

- [ ] **Step 1: 키보드 토글 테스트 추가**

`tests/a11y.test.ts` 에 추가:

```typescript
  test('hero toggle reachable by keyboard and operable with Enter', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' });
    await page.locator('#hero-tg-on').focus();
    await expect(page.locator('#hero-tg-on')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#hero-state-on')).toBeVisible();
    await expect(page.locator('#hero-tg-on')).toHaveAttribute('aria-pressed', 'true');
  });
```

- [ ] **Step 2: 통과 확인**

Run: `pnpm --filter @ps-neko/visualizer test:a11y`
Expected: PASS (button 기본 동작으로 추가 구현 없이 통과).

- [ ] **Step 3: 커밋**

```bash
git -C C:/Users/Mun/harness add packages/nekowork-cli/docs/visualizer/tests/a11y.test.ts
git -C C:/Users/Mun/harness commit -m "test(visualizer): hero 토글 키보드 접근성 회귀 테스트"
```

---

## Task 5: gen-hero-gif — `.hero` 셀렉터 + before/after 2프레임

**Files:**
- Modify: `scripts/gen-hero-gif.ts` (`captureFrames`)

- [ ] **Step 1: `captureFrames()` 의 wedge 대기 + 섹션 시퀀스 교체**

기존:
```typescript
    await page.waitForSelector('.wedge', { state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(800);

    const sections = ['.wedge', '.conflict', '.stations', '.evidence'];
    for (let i = 0; i < sections.length; i++) {
      if (i > 0) {
        const sel = sections[i]!;
        await page.evaluate((s) => {
          document.querySelector(s)?.scrollIntoView({ behavior: 'instant', block: 'start' });
        }, sel);
        await page.waitForTimeout(400);
      }
      const idx = String(i + 1).padStart(3, '0');
      await page.screenshot({
        path: join(framesDir, `frame-${idx}.png`),
        fullPage: false
      });
    }
```

변경 (hero off → hero on(토글 클릭) → conflict → stations → evidence, 5프레임):
```typescript
    await page.waitForSelector('.hero', { state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(800);

    // frame 1: hero (NEKOWORK 없이 / before)
    await page.screenshot({ path: join(framesDir, 'frame-001.png'), fullPage: false });

    // frame 2: hero (NEKOWORK 켜기 / after) — 토글 클릭 후
    await page.click('#hero-tg-on');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(framesDir, 'frame-002.png'), fullPage: false });

    // frame 3~5: conflict → stations → evidence
    const sections = ['.conflict', '.stations', '.evidence'];
    for (let i = 0; i < sections.length; i++) {
      const sel = sections[i]!;
      await page.evaluate((s) => {
        document.querySelector(s)?.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, sel);
      await page.waitForTimeout(400);
      const idx = String(i + 3).padStart(3, '0');
      await page.screenshot({ path: join(framesDir, `frame-${idx}.png`), fullPage: false });
    }
```

- [ ] **Step 2: 빌드 후 GIF 생성**

Run:
```bash
pnpm --filter @ps-neko/visualizer build
pnpm --filter @ps-neko/visualizer gen-hero-gif
```
Expected: `OK hero.gif within 5MB budget`, exit 0. (로컬에 ffmpeg 없으면 메시지대로 `scoop/choco install ffmpeg` 후 재실행; CI 는 apt 로 설치됨.)

- [ ] **Step 3: 커밋**

```bash
git -C C:/Users/Mun/harness add packages/nekowork-cli/docs/visualizer/scripts/gen-hero-gif.ts packages/nekowork-cli/assets/hero.gif
git -C C:/Users/Mun/harness commit -m "feat(visualizer): hero GIF 를 before/after 토글 2프레임으로 재생성"
```

---

## Task 6: 최종 검증 (build + typecheck + 전체 a11y + 수동 시각)

**Files:** 없음 (검증 only)

- [ ] **Step 1: 타입체크**

Run: `pnpm --filter @ps-neko/visualizer typecheck`
Expected: PASS, 0 errors.

- [ ] **Step 2: 프로덕션 빌드**

Run: `pnpm --filter @ps-neko/visualizer build`
Expected: `dist/` 생성, 빌드 에러 0.

- [ ] **Step 3: 전체 a11y/E2E 스위트**

Run: `pnpm --filter @ps-neko/visualizer test:a11y`
Expected: 모든 테스트 PASS.

- [ ] **Step 4: 로컬 시각 확인 (수동)**

Run: `pnpm --filter @ps-neko/visualizer preview`
브라우저에서 `http://localhost:4173/NEKOWORK/?fixture=sample-pr-001` 열기. 확인:
- hero 타이틀/eyebrow/서브, 다크테마
- 토글 클릭 시 before↔after 전환 + 캡션 변경
- 스크롤 시 ②같은 코드 다른 결론(PR 식별 줄 포함) → ③12단계 → ④evidence
Expected: 시각 회귀 없음. (확인 후 Ctrl+C)

- [ ] **Step 5: 마커 일관성 (선행 doc CI 게이트와 동일)**

Run:
```bash
node C:/Users/Mun/harness/scripts/ci/check-markers.js
```
Expected: PASS.

- [ ] **Step 6: 최종 상태 확인**

Run: `git -C C:/Users/Mun/harness status --short && git -C C:/Users/Mun/harness log --oneline -8`
Expected: 워킹트리 깨끗, Task 1~5 커밋 존재.

---

## Out of Scope (이번 plan 에서 구현하지 않음 — spec 과 일치)

- audit-integrity / `sample-pr-002` / "못 속인다(해자)" 섹션
- timeline scrubber 풀버전 (다단계 `<input type="range">`)
- 비주얼 전면 개편 (색/타이포 시스템 교체)
- 12단계 그리드 / evidence 내용 변경

## 배포 (별도, 사용자 확인 후)

- PR 생성 → `harness-validate` + `visualizer-deploy` CI green 확인 → main 머지 시 GitHub Pages 자동 재배포.
- push/PR/merge 는 사용자 명시 확인 후 진행 (사용자 룰).
