import { classifyRisk } from './risk-classifier.js';

const RELEASE_RE = /\b(release|changelog|version|npm|publish|package|dist[- ]tag|release notes|tag)\b/i;
const TEST_RE = /\b(test|tests|testing|tdd|coverage|spec|regression|unit|e2e|integration)\b/i;
const DOCS_RE = /\b(readme|docs|documentation|markdown|copy|typo|spelling)\b/i;
const UI_RE = /\b(ui|ux|frontend|react|component|dashboard|mockup|wireframe|prototype|accessibility|a11y)\b/i;

const KOREAN_RELEASE_RE = new RegExp('\\uB9B4\\uB9AC\\uC2A4|\\uB9B4\\uB9AC\\uC988|\\uBC30\\uD3EC\\s*\\uC900\\uBE44|\\uBC84\\uC804|\\uCCB4\\uC778\\uC9C0\\uB85C\\uADF8|\\uD328\\uD0A4\\uC9C0|\\uBC1C\\uD589');
const KOREAN_TEST_RE = new RegExp('\\uD14C\\uC2A4\\uD2B8|\\uAC80\\uC99D|\\uCEE4\\uBC84\\uB9AC\\uC9C0|\\uD68C\\uADC0');
const KOREAN_DOCS_RE = new RegExp('\\uBB38\\uC11C|\\uB9AC\\uB4DC\\uBBF8|\\uC624\\uD0C0|\\uB9C8\\uD06C\\uB2E4\\uC6B4');
const KOREAN_UI_RE = new RegExp('\\uD654\\uBA74|\\uD504\\uB860\\uD2B8|\\uCEF4\\uD3EC\\uB10C\\uD2B8|\\uB300\\uC2DC\\uBCF4\\uB4DC|\\uBAA9\\uC5C5|\\uC811\\uADFC\\uC131');

export function analyzeBuildIntent({ task = '' } = {}) {
  const text = String(task || '').trim();
  const classification = classifyRisk({ task: text, files: [] });
  const signals = detectSignals(text, classification);
  const taskType = classifyTaskType(signals, classification);
  const recommendedMode = recommendMode(taskType, signals, classification);
  const workers = recommendWorkers(recommendedMode, taskType, signals, classification);

  return {
    version: 'build-intelligence-v0',
    task,
    taskType,
    recommendedMode,
    profile: recommendedMode === 'safe' ? 'security' : 'quality',
    strictQuality: recommendedMode === 'safe' || recommendedMode === 'tdd',
    secure: recommendedMode === 'safe' || classification.requiresCodexChallenge,
    team: workers.length > 0,
    workers,
    risk: classification.risk,
    tags: classification.tags,
    requiresCodexChallenge: classification.requiresCodexChallenge,
    requiresHumanGate: classification.requiresHumanGate,
    signals,
    reasons: buildReasons(recommendedMode, taskType, signals, classification),
    acceptanceCriteria: buildAcceptanceCriteria(text, taskType, recommendedMode),
    miniPlan: buildMiniPlan(recommendedMode, taskType),
    selfCheck: buildSelfCheck(recommendedMode, taskType),
  };
}

function detectSignals(task, classification) {
  return {
    security: classification.tags.includes('security'),
    financial: classification.tags.includes('financial'),
    deploy: classification.tags.includes('deploy'),
    data: classification.tags.includes('data'),
    productUi: classification.tags.includes('product-ui') || UI_RE.test(task) || KOREAN_UI_RE.test(task),
    release: RELEASE_RE.test(task) || KOREAN_RELEASE_RE.test(task),
    test: TEST_RE.test(task) || KOREAN_TEST_RE.test(task),
    docs: DOCS_RE.test(task) || KOREAN_DOCS_RE.test(task),
  };
}

function classifyTaskType(signals, classification) {
  if (signals.financial) return 'financial-sensitive';
  if (signals.security) return 'security-sensitive';
  if (signals.data) return 'data-sensitive';
  if (signals.deploy && !signals.release) return 'deploy-sensitive';
  if (signals.release) return 'release-readiness';
  if (signals.test) return 'test-focused';
  if (signals.productUi) return 'product-ui';
  if (signals.docs) return 'documentation';
  if (classification.risk === 'high' || classification.risk === 'critical') return 'risk-sensitive';
  return 'implementation';
}

function recommendMode(taskType, signals, classification) {
  if (taskType === 'release-readiness') return 'release';
  if (
    ['security-sensitive', 'financial-sensitive', 'data-sensitive', 'deploy-sensitive', 'risk-sensitive'].includes(taskType) ||
    classification.requiresHumanGate
  ) {
    return 'safe';
  }
  if (taskType === 'test-focused') return 'tdd';
  if (taskType === 'product-ui' || (signals.productUi && !signals.docs)) return 'team';
  return 'fast';
}

function recommendWorkers(mode, taskType, signals) {
  if (mode === 'safe') {
    if (taskType === 'financial-sensitive') return ['planner', 'product', 'security', 'test'];
    return ['planner', 'security', 'test'];
  }
  if (mode === 'team') {
    return signals.productUi
      ? ['planner', 'product', 'design', 'security', 'test']
      : ['planner', 'product', 'security', 'test'];
  }
  if (mode === 'tdd') return ['planner', 'test'];
  if (mode === 'release') return ['planner', 'test'];
  return [];
}

function buildReasons(mode, taskType, signals, classification) {
  const reasons = [`task_type=${taskType}`, `risk=${classification.risk}`];
  if (classification.tags.length) reasons.push(`tags=${classification.tags.join(',')}`);
  if (classification.requiresHumanGate) reasons.push('human_gate_required_by_risk_policy');
  if (classification.requiresCodexChallenge) reasons.push('codex_challenge_required_by_risk_policy');
  if (signals.release) reasons.push('release_or_package_signal');
  if (signals.test) reasons.push('test_or_coverage_signal');
  if (signals.productUi) reasons.push('product_ui_signal');
  reasons.push(`selected_mode=${mode}`);
  return reasons;
}

function buildAcceptanceCriteria(task, taskType, mode) {
  const cleanTask = task || 'requested build task';
  const rows = [
    `AC-001: Requested outcome is implemented for: ${cleanTask}`,
    'AC-002: Existing behavior outside the selected scope is preserved or explicitly documented.',
    'AC-003: Verification evidence is recorded before ship or apply.',
  ];

  if (mode === 'safe') {
    rows.push('AC-004: Sensitive boundaries, secrets, auth, data, deployment, or financial risk are reviewed before ship.');
  } else if (mode === 'tdd') {
    rows.push('AC-004: Test or regression evidence covers the requested behavior before ship.');
  } else if (mode === 'team') {
    rows.push('AC-004: Product, design, security, and test perspectives are captured as read-only handoffs before implementation.');
  } else if (mode === 'release') {
    rows.push('AC-004: Release readiness, rollback or no-ship conditions, and user-facing notes are documented.');
  } else if (taskType === 'documentation') {
    rows.push('AC-004: Documentation changes are clear, scoped, and do not imply unverified product behavior.');
  }

  return rows.map((desc, index) => ({
    id: `AC-${String(index + 1).padStart(3, '0')}`,
    desc: desc.replace(/^AC-\d+:\s*/, ''),
    passes: false,
    source: 'build-intelligence-v0',
  }));
}

function buildMiniPlan(mode, taskType) {
  const plan = [
    `Classify task as ${taskType} and use ${mode} build mode.`,
    'Define acceptance criteria before implementation starts.',
  ];
  if (mode === 'team') plan.push('Collect read-only team handoffs before the single executor writes.');
  if (mode === 'safe') plan.push('Require security profile, strict evidence, and Codex challenge before ship.');
  if (mode === 'tdd') plan.push('Prioritize test strategy and acceptance coverage evidence before ship.');
  if (mode === 'release') plan.push('Focus on ship readiness, no-ship conditions, and report evidence.');
  plan.push('Run single-executor work, Codex verification, and ship readiness.');
  plan.push('Leave apply explicit and evidence-gated.');
  return plan;
}

function buildSelfCheck(mode, taskType) {
  const checks = [
    'Acceptance criteria are represented in the session artifacts.',
    'No project mutation occurs outside the single executor or explicit apply path.',
    'Codex verification evidence exists before ship readiness.',
  ];
  if (mode === 'safe') checks.push('Sensitive-risk findings include evidence, required fix, confidence, and gate status.');
  if (mode === 'tdd') checks.push('Test or regression evidence is mapped to acceptance criteria.');
  if (mode === 'team') checks.push('Team handoffs remain read-only and implementation remains single-executor.');
  if (mode === 'release') checks.push('Release readiness and no-ship conditions are visible in the report.');
  if (taskType === 'documentation') checks.push('Documentation does not claim behavior that verification did not cover.');
  checks.push('Apply remains opt-in and gated by SHIP_READY plus clear gates.');
  return checks;
}
