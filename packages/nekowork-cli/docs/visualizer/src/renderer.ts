/**
 * Renderer — Phase 1.0 정적 SVG/HTML.
 * design doc Path 1 + Path 2:
 *   - first-frame hero workflow toggle (above the fold)
 *   - Claude advisor (LGTM) vs NEKOWORK rule (BLOCK) conflict frame
 *   - 12-station grid (aria-label, status badge)
 */

import { renderHero } from './hero.js';
import { STATIONS, type Station, type StationStatus } from './stations.js';
import type { Fixture } from './fixtures.js';

export function render(root: HTMLElement, fixture: Fixture): void {
  root.innerHTML = `
    ${renderHero()}
    <main class="layout" data-fixture-id="${escapeAttr(fixture.id)}">
      ${renderDemoSummary(fixture)}
      ${renderConflictFrame(fixture)}
      ${renderKeyEvidence(fixture)}
      ${renderStationGrid(fixture)}
      ${renderEvidenceTrail(fixture)}
    </main>
  `;
}

function renderDemoSummary(fixture: Fixture): string {
  const detail = fixture.decision.deterministicRulesDetail;
  const ruleLabel = detail?.ruleId ?? 'deterministic rule';
  const blocked = fixture.decision.apply.allowed ? '적용 가능' : '적용 차단';
  const steps = [
    {
      label: '1. AI가 코드 작성',
      value: fixture.samplePr.title,
      tone: 'neutral'
    },
    {
      label: '2. AI 리뷰 통과',
      value: `Claude: ${fixture.claudeReview.verdict}`,
      tone: 'info'
    },
    {
      label: '3. 규칙이 위험 발견',
      value: ruleLabel,
      tone: 'danger'
    },
    {
      label: '4. 증거로 설명',
      value: detail ? `${detail.file}:${detail.line}` : 'evidence linked',
      tone: 'warn'
    },
    {
      label: '5. 병합 전 멈춤',
      value: blocked,
      tone: 'success'
    }
  ];

  return `
    <section class="summary" aria-label="NEKOWORK demo summary">
      <div class="section-heading">
        <p class="section-heading__eyebrow">한눈에 보는 흐름</p>
        <h2>AI 도구 → NEKOWORK 검사 → 사람 승인</h2>
        <p>이 데모는 AI가 좋다고 말한 PR을 NEKOWORK가 어떤 근거로 멈추는지 보여줍니다.</p>
      </div>
      <ol class="summary__steps" role="list">
        ${steps
          .map(
            (step) => `
          <li class="summary__step summary__step--${escapeAttr(step.tone)}">
            <span>${escapeHtml(step.label)}</span>
            <strong>${escapeHtml(step.value)}</strong>
          </li>`
          )
          .join('')}
      </ol>
    </section>
  `;
}

function renderConflictFrame(fixture: Fixture): string {
  const { decision, claudeReview } = fixture;
  const nekoBadge = badgeFor(decision.verdict, decision.riskLevel);
  const advisorBadge =
    claudeReview.verdict === 'LGTM'
      ? '<span class="badge badge--advisor-info">AI 의견: 문제없음</span>'
      : '<span class="badge badge--advisor-warn">AI 의견: 수정 필요</span>';

  const sourceLabel =
    claudeReview.source === 'manufactured'
      ? '<span class="source-tag source-tag--manufactured">샘플 AI 리뷰</span>'
      : `<span class="source-tag source-tag--recorded">기록된 리뷰${claudeReview.attribution ? ` · ${escapeHtml(claudeReview.attribution)}` : ''}</span>`;

  return `
    <section class="conflict" aria-label="Claude advisor vs NEKOWORK rule comparison">
      <div class="section-heading conflict__heading">
        <p class="section-heading__eyebrow"><code>${escapeHtml(fixture.samplePr.pr_id)}</code> ${escapeHtml(fixture.samplePr.head_branch)}</p>
        <h2>같은 코드, 다른 결론</h2>
        <p>${escapeHtml(fixture.samplePr.description)}</p>
      </div>
      <article class="conflict__column conflict__column--advisor" data-source="advisor" aria-label="Advisor opinion">
        <header class="conflict__header">
          <span class="badge badge--advisor">AI 리뷰</span>
          ${sourceLabel}
        </header>
        <p class="conflict__verdict">${advisorBadge}</p>
        <ul class="conflict__comments">
          ${claudeReview.comments
            .map(
              (c) => `
            <li>
              <code>${escapeHtml(c.file)}:${c.line}</code> ${escapeHtml(c.body)}
            </li>`
            )
            .join('')}
        </ul>
      </article>
      <article class="conflict__column conflict__column--neko" data-source="rule" aria-label="NEKOWORK rule verdict">
        <header class="conflict__header">
          <span class="badge badge--neko">NEKOWORK 규칙 검사</span>
        </header>
        <p class="conflict__verdict">${nekoBadge}</p>
        ${renderRuleDetail(fixture)}
        <p class="conflict__apply">
          apply.allowed = <strong>${decision.apply.allowed ? 'true' : 'false'}</strong>
          ${decision.apply.reason ? `<br/><small>${escapeHtml(decision.apply.reason)}</small>` : ''}
        </p>
      </article>
    </section>
  `;
}

function renderKeyEvidence(fixture: Fixture): string {
  const detail = fixture.decision.deterministicRulesDetail;
  const riskyLine = extractRiskyLine(fixture);
  const ruleId = detail?.ruleId ?? 'deterministic rule';
  const file = detail ? `${detail.file}:${detail.line}` : 'evidence file';
  const pattern = detail?.pattern ?? 'rule pattern';
  const applyText = fixture.decision.apply.allowed ? 'true' : 'false';

  return `
    <section class="key-evidence" id="evidence-focus" aria-label="BLOCK reason explained">
      <div class="section-heading">
        <p class="section-heading__eyebrow">왜 BLOCK인가</p>
        <h2>환경변수가 없을 때, 숨겨진 기본 비밀키가 사용됩니다.</h2>
        <p>이 패턴은 운영 환경에서 같은 JWT 서명 키가 고정될 수 있어 인증 보안을 망가뜨릴 수 있습니다.</p>
      </div>

      <div class="key-evidence__grid">
        <article class="key-evidence__code" aria-label="위험 코드 줄">
          <span class="key-evidence__label">문제 줄</span>
          <code>${escapeHtml(file)}</code>
          <pre><code>${escapeHtml(riskyLine)}</code></pre>
        </article>

        <div class="key-evidence__facts" aria-label="차단 근거 요약">
          <article>
            <span>감지 규칙</span>
            <strong>${escapeHtml(ruleId)}</strong>
          </article>
          <article>
            <span>감지 패턴</span>
            <strong><code>${escapeHtml(pattern)}</code></strong>
          </article>
          <article>
            <span>최종 적용</span>
            <strong><code>apply.allowed = ${applyText}</code></strong>
          </article>
        </div>
      </div>
    </section>
  `;
}

function renderRuleDetail(fixture: Fixture): string {
  const detail = fixture.decision.deterministicRulesDetail;
  if (!detail) {
    return '<p class="conflict__rule-empty">no deterministic rule detail</p>';
  }
  return `
    <ul class="conflict__rule">
      <li><strong>rule:</strong> <code>${escapeHtml(detail.ruleId)}</code></li>
      <li><strong>file:</strong> <code>${escapeHtml(detail.file)}:${detail.line}</code></li>
      <li><strong>pattern:</strong> <code>${escapeHtml(detail.pattern)}</code></li>
    </ul>
  `;
}

function renderStationGrid(fixture: Fixture): string {
  const cells = STATIONS.map((station, idx) => {
    const status = stationStatusFor(station, fixture);
    return renderStationCell(station, status, idx + 1);
  }).join('');

  return `
    <section class="stations" id="stations" aria-label="12-station verification factory">
      <details class="stations__details">
        <summary>
          <span>
            <strong>12단계 검증 전체 보기</strong>
            <small>처음에는 핵심 판정만 보고, 필요할 때 전체 파이프라인을 펼칩니다.</small>
          </span>
        </summary>
        <ol class="stations__grid" role="list">
          ${cells}
        </ol>
      </details>
    </section>
  `;
}

function renderStationCell(station: Station, status: StationStatus, position: number): string {
  return `
    <li
      class="station station--${status}"
      data-station-id="${escapeAttr(station.id)}"
      data-cell-group="${escapeAttr(station.cellGroup)}"
      aria-label="station ${position} of ${STATIONS.length}, ${escapeAttr(station.label)}, status: ${status}"
    >
      <span class="station__pos">${position.toString().padStart(2, '0')}</span>
      <span class="station__label">${escapeHtml(station.label)}</span>
      <span class="station__status">${status.toUpperCase()}</span>
      <p class="station__desc">${escapeHtml(station.description)}</p>
    </li>
  `;
}

function renderEvidenceTrail(fixture: Fixture): string {
  const items = Object.entries(fixture.decision.evidence).map(
    ([k, v]) => `
      <li>
        <span>
          <strong>${escapeHtml(evidenceLabel(k))}</strong>
          <small>${escapeHtml(evidenceHint(k))}</small>
        </span>
        <code>${escapeHtml(String(v))}</code>
      </li>`
  );
  return `
    <section class="evidence" aria-label="evidence trail">
      <div class="section-heading">
        <p class="section-heading__eyebrow">증거 파일</p>
        <h2>판정은 파일로 남습니다.</h2>
        <p>리뷰어는 아래 파일에서 어떤 검사와 어떤 결론이 나왔는지 다시 확인할 수 있습니다.</p>
      </div>
      <ul class="evidence__list">${items.join('')}</ul>
    </section>
  `;
}

function badgeFor(verdict: string, risk: string): string {
  const cls = verdict === 'BLOCK' ? 'badge--block' : verdict === 'PASS' ? 'badge--pass' : 'badge--warn';
  return `<span class="badge ${cls}">${escapeHtml(verdict)} · 위험도 ${escapeHtml(risk)}</span>`;
}

function evidenceLabel(key: string): string {
  const labels: Record<string, string> = {
    report_path: '사람이 읽는 리포트',
    preverify_summary: '사전 점검 결과',
    verify_summary: '검증 요약',
    stage_decision: '최종 판정 JSON',
    advisor_claude: 'AI 리뷰 원문'
  };
  return labels[key] ?? key;
}

function evidenceHint(key: string): string {
  const hints: Record<string, string> = {
    report_path: '무엇이 막혔는지 설명',
    preverify_summary: '기본 체크 상태',
    verify_summary: '게이트별 통과/실패',
    stage_decision: 'apply.allowed=false 근거',
    advisor_claude: 'AI가 남긴 의견'
  };
  return hints[key] ?? 'linked evidence';
}

function extractRiskyLine(fixture: Fixture): string {
  const detail = fixture.decision.deterministicRulesDetail;
  const processEnvFallback = fixture.samplePr.diff_content
    .split('\n')
    .find((line) => line.startsWith('+') && line.includes('process.env') && line.includes('||'));

  if (processEnvFallback) {
    return processEnvFallback.slice(1);
  }

  if (detail) {
    return `${detail.file}:${detail.line} matched ${detail.pattern}`;
  }

  return 'Matched a deterministic security rule.';
}

function stationStatusFor(station: Station, fixture: Fixture): StationStatus {
  const decision = fixture.decision;

  if (station.id === 'deterministic-rules') {
    return decision.deterministicRules?.status === 'failed' ? 'fail' : 'pass';
  }
  if (station.id === 'advisor-review') {
    const adapter = decision.reviewAdapters?.find((a) => a.adapterId === 'claude');
    if (!adapter) return 'skip';
    if (adapter.status === 'passed') return 'pass';
    if (adapter.status === 'warnings') return 'warn';
    if (adapter.status === 'failed') return 'fail';
    return 'skip';
  }
  if (station.id === 'human-gate') {
    if (decision.humanApprovalRequired && !decision.humanApproved) return 'pending';
    return decision.humanApproved ? 'pass' : 'skip';
  }
  if (station.id === 'apply') {
    return decision.apply.allowed ? 'pass' : 'fail';
  }
  if (station.id === 'preverify') {
    const fail = fixture.preverifySummary.summary['fail'] ?? 0;
    const pending = fixture.preverifySummary.summary['pending'] ?? 0;
    if (fail > 0) return 'fail';
    if (pending > 0) return 'pending';
    return 'pass';
  }
  return 'pass';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
