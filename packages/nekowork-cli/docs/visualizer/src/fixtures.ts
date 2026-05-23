/**
 * Fixture loader — D3 lock (2026-05-23 plan).
 * import.meta.glob 으로 fixtures/sample-pr-NNN/* 를 자동 스캔하고,
 * sample-pr.json 의 알파벳 정렬 순서로 enumerate 한다.
 */

export interface SamplePr {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly audience: string;
  readonly purpose: string;
  readonly language: 'ko' | 'en';
  readonly pr_id: string;
  readonly base_branch: string;
  readonly head_branch: string;
  readonly files_changed: readonly string[];
  readonly stats: { additions: number; deletions: number; files: number };
  readonly diff_hash: string;
  readonly diff_content: string;
}

export interface Decision {
  readonly schemaVersion: '0.5';
  readonly project: string;
  readonly taskId: string;
  readonly workflowStage: string;
  readonly verdict: 'PASS' | 'PASS_WITH_WARNINGS' | 'NEEDS_HUMAN_REVIEW' | 'BLOCK' | 'INSUFFICIENT_EVIDENCE';
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly humanApprovalRequired: boolean;
  readonly humanApproved: boolean;
  readonly deterministicRules?: {
    status: 'passed' | 'failed';
    triggeredRules: readonly string[];
  };
  readonly deterministicRulesDetail?: {
    ruleId: string;
    file: string;
    line: number;
    pattern: string;
  };
  readonly reviewAdapters?: ReadonlyArray<{
    adapterId: string;
    status: 'passed' | 'warnings' | 'failed' | 'not_run';
    findingsCount: number;
    criticalFindings: number;
    summary: string;
  }>;
  readonly evidence: Readonly<Record<string, string>>;
  readonly apply: { allowed: boolean; reason?: string };
  readonly generatedAt?: string;
}

export interface ClaudeReview {
  readonly source: 'manufactured' | 'recorded';
  readonly verdict: 'LGTM' | 'REQUEST_CHANGES';
  readonly comments: ReadonlyArray<{
    file: string;
    line: number;
    body: string;
  }>;
  readonly attribution?: string;
}

export interface PreverifySummary {
  readonly schemaVersion: 'preverify-v0';
  readonly project: string;
  readonly taskId: string;
  readonly generatedAt: string;
  readonly checks: ReadonlyArray<{
    name: string;
    status: 'pass' | 'warn' | 'fail' | 'pending';
    message: string;
  }>;
  readonly summary: Readonly<Record<string, number>>;
}

export interface VerifySummary {
  readonly schemaVersion: 'verify-v0';
  readonly project: string;
  readonly taskId: string;
  readonly generatedAt: string;
  readonly acceptance_coverage: {
    required: readonly string[];
    met: readonly string[];
    missing: readonly string[];
  };
  readonly gates: ReadonlyArray<{
    id: string;
    status: 'passed' | 'warnings' | 'failed' | 'pending';
    summary: string;
  }>;
  readonly summary: { verdict: string; riskLevel: string; applyAllowed: boolean };
}

export interface Fixture {
  readonly id: string;
  readonly samplePr: SamplePr;
  readonly decision: Decision;
  readonly claudeReview: ClaudeReview;
  readonly preverifySummary: PreverifySummary;
  readonly verifySummary: VerifySummary;
  readonly stageDecision: Decision;
  readonly report: string;
}

const samplePrModules = import.meta.glob<SamplePr>('../fixtures/*/sample-pr.json', {
  eager: true,
  import: 'default'
});

const decisionModules = import.meta.glob<Decision>('../fixtures/*/decision.json', {
  eager: true,
  import: 'default'
});

const claudeReviewModules = import.meta.glob<ClaudeReview>('../fixtures/*/claude-review.json', {
  eager: true,
  import: 'default'
});

const preverifyModules = import.meta.glob<PreverifySummary>(
  '../fixtures/*/evidence/preverify-summary.json',
  { eager: true, import: 'default' }
);

const verifyModules = import.meta.glob<VerifySummary>('../fixtures/*/evidence/verify-summary.json', {
  eager: true,
  import: 'default'
});

const stageDecisionModules = import.meta.glob<Decision>('../fixtures/*/evidence/decision.json', {
  eager: true,
  import: 'default'
});

const reportModules = import.meta.glob<string>('../fixtures/*/REPORT.md', {
  eager: true,
  import: 'default',
  query: '?raw'
});

function extractId(path: string): string {
  const match = path.match(/fixtures\/([^/]+)\//);
  if (!match || !match[1]) {
    throw new Error(`fixtures: cannot extract id from ${path}`);
  }
  return match[1];
}

export function loadFixtures(): readonly Fixture[] {
  const ids = Object.keys(samplePrModules)
    .map((p) => extractId(p))
    .sort();

  return ids.map((id) => {
    const samplePr = pickById(samplePrModules, id, 'sample-pr.json');
    const decision = pickById(decisionModules, id, 'decision.json');
    const claudeReview = pickById(claudeReviewModules, id, 'claude-review.json');
    const preverifySummary = pickById(preverifyModules, id, 'evidence/preverify-summary.json');
    const verifySummary = pickById(verifyModules, id, 'evidence/verify-summary.json');
    const stageDecision = pickById(stageDecisionModules, id, 'evidence/decision.json');
    const report = pickById(reportModules, id, 'REPORT.md');

    return {
      id,
      samplePr,
      decision,
      claudeReview,
      preverifySummary,
      verifySummary,
      stageDecision,
      report
    };
  });
}

function pickById<T>(modules: Record<string, T>, id: string, label: string): T {
  const entry = Object.entries(modules).find(([p]) => p.includes(`/fixtures/${id}/`));
  if (!entry) {
    throw new Error(`fixtures: missing ${label} for id=${id}`);
  }
  return entry[1];
}

export function selectFixture(fixtures: readonly Fixture[], requestedId: string | null): Fixture {
  if (fixtures.length === 0) {
    throw new Error('fixtures: no fixture loaded — check fixtures/sample-pr-*/sample-pr.json');
  }
  if (requestedId) {
    const found = fixtures.find((f) => f.id === requestedId);
    if (found) return found;
  }
  const first = fixtures[0];
  if (!first) {
    throw new Error('fixtures: unreachable — fixtures.length > 0 but [0] undefined');
  }
  return first;
}
