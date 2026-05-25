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
      ${renderConflictFrame(fixture)}
      ${renderStationGrid(fixture)}
      ${renderEvidenceTrail(fixture)}
    </main>
  `;
}

function renderConflictFrame(fixture: Fixture): string {
  const { decision, claudeReview } = fixture;
  const nekoBadge = badgeFor(decision.verdict, decision.riskLevel);
  const advisorBadge =
    claudeReview.verdict === 'LGTM'
      ? '<span class="badge badge--advisor-info">괜찮음</span>'
      : '<span class="badge badge--advisor-warn">변경 요청</span>';

  const sourceLabel =
    claudeReview.source === 'manufactured'
      ? '<span class="source-tag source-tag--manufactured">manufactured demo</span>'
      : `<span class="source-tag source-tag--recorded">recorded${claudeReview.attribution ? ` · ${escapeHtml(claudeReview.attribution)}` : ''}</span>`;

  return `
    <section class="conflict" aria-label="Claude advisor vs NEKOWORK rule comparison">
      <p class="conflict__pr"><code>${escapeHtml(fixture.samplePr.pr_id)}</code> ${escapeHtml(fixture.samplePr.title)}</p>
      <h2 class="conflict__title">같은 코드, 다른 결론</h2>
      <article class="conflict__column conflict__column--advisor" data-source="advisor" aria-label="Advisor opinion">
        <header class="conflict__header">
          <span class="badge badge--advisor">Advisor: Claude</span>
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
          <span class="badge badge--neko">NEKOWORK: Rule + Evidence</span>
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
    <section class="stations" aria-label="12-station verification factory">
      <h2 class="stations__title">12-station verification factory</h2>
      <ol class="stations__grid" role="list">
        ${cells}
      </ol>
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
    ([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> <code>${escapeHtml(String(v))}</code></li>`
  );
  return `
    <section class="evidence" aria-label="evidence trail">
      <h2 class="evidence__title">Evidence trail</h2>
      <ul class="evidence__list">${items.join('')}</ul>
    </section>
  `;
}

function badgeFor(verdict: string, risk: string): string {
  const cls = verdict === 'BLOCK' ? 'badge--block' : verdict === 'PASS' ? 'badge--pass' : 'badge--warn';
  return `<span class="badge ${cls}">${escapeHtml(verdict)} · ${escapeHtml(risk)}</span>`;
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
