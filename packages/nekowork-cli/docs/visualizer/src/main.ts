import './styles.css';
import { loadFixtures, selectFixture } from './fixtures.js';
import { render } from './renderer.js';
import { initHeroToggle } from './hero.js';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) {
  throw new Error('visualizer: #app root not found');
}

const fixtures = loadFixtures();
const params = new URLSearchParams(window.location.search);
const requested = params.get('fixture');
const fixture = selectFixture(fixtures, requested);

render(root, fixture);
initHeroToggle(root);

const form = root.querySelector<HTMLFormElement>('#local-import-form');
const status = root.querySelector<HTMLElement>('#local-import-status');
const result = root.querySelector<HTMLElement>('#local-import-result');
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const decisionFile = (form.elements.namedItem('decision') as HTMLInputElement).files?.[0];
  const reportFile = (form.elements.namedItem('report') as HTMLInputElement).files?.[0];
  if (!decisionFile || !reportFile || !status || !result) return;
  try {
    const decision = JSON.parse(await decisionFile.text()) as Record<string, unknown>;
    if (decision.schema_version !== 'verify-pr-v0' || typeof decision.verdict !== 'string' || typeof decision.reason !== 'string' || typeof decision.risk_level !== 'string' || typeof decision.apply_allowed !== 'boolean') throw new Error('NEKOWORK verify-pr가 만든 decision.json 파일을 선택해 주세요.');
    const report = await reportFile.text();
    status.textContent = '파일은 이 브라우저 안에서만 읽었습니다. 서버로 전송하지 않습니다.';
    result.hidden = false;
    result.innerHTML = `<section class="decision-card"><div class="decision-card__status"><span class="decision-card__eyebrow">불러온 결과</span><strong></strong></div><div class="decision-card__body"><h2></h2><p></p><dl class="decision-card__facts"><div><dt>위험 수준</dt><dd></dd></div><div><dt>자동 반영</dt><dd></dd></div></dl></div></section><details class="import-report"><summary>REPORT.md 보기</summary><pre></pre></details>`;
    const text = result.querySelectorAll<HTMLElement>('strong, h2, p, dd, pre');
    text[0]!.textContent = decision.verdict as string;
    text[1]!.textContent = decision.apply_allowed ? '사람의 확인 후 다음 단계로 진행할 수 있습니다' : '자동 반영이 차단되었습니다';
    text[2]!.textContent = decision.reason as string;
    text[3]!.textContent = decision.risk_level as string;
    text[4]!.textContent = decision.apply_allowed ? '허용' : '차단';
    text[5]!.textContent = report;
  } catch (error) { status.textContent = error instanceof Error ? error.message : '파일을 읽을 수 없습니다.'; }
});
