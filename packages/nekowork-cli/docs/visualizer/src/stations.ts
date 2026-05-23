/**
 * 12-station verification factory — Phase 1.0 lock (VIZ-STATION-MAP partial 진행 후).
 *
 * forge-engine 14단계 (FACTORY-CELLS.md) ↔ visualizer 12-station 1:1 매핑:
 *
 * | # | visualizer station   | forge-engine 14단계 매핑 |
 * |---|----------------------|--------------------------|
 * |  1| intake               | intake (Product Cell)     |
 * |  2| spec                 | clarify + spec (Product, 묶음) |
 * |  3| plan                 | context + harness-design + plan (Architecture+Build, 묶음) |
 * |  4| build                | work (Build Cell, "work" 의 사용자 친화 라벨) |
 * |  5| preverify            | (전용 — 6-axis 사전 체크, FACTORY-CELLS 외 추가 게이트) |
 * |  6| deterministic-rules  | quality-policy + rule pack 검증 (Quality, wedge BLOCK 발생 지점) |
 * |  7| quality-contract     | quality-contract (Quality) |
 * |  8| quality-score        | quality-score (Quality) |
 * |  9| self-review          | self-review (Review) |
 * | 10| advisor-review       | codex-review + architecture-review + design-review (advisor 묶음, wedge LGTM 발생 지점) |
 * | 11| human-gate           | gate (Gate) — Human Gate 의 사용자 친화 라벨 |
 * | 12| apply                | apply (Gate) |
 *
 * 묶음 규칙: visualizer 는 wedge frame 전달 우선 — 한 화면의 인지 부담 < 15 항목.
 * team 단계는 본 fixture 의 single-executor narrative 에 흡수 (handoff 없음).
 * 14단계의 Memory 부속 (memory/eval-cases/benchmark) 은 Stage 4 의 시계열 trend 시각화로 분리.
 *
 * Source-of-truth: forge-engine docs/FACTORY-CELLS.md. 정합성 변경 시 본 파일 동반 수정.
 */

export type StationStatus = 'pass' | 'fail' | 'warn' | 'pending' | 'skip';

export interface Station {
  readonly id: string;
  readonly label: string;
  readonly cellGroup: 'product' | 'architecture' | 'build' | 'quality' | 'review' | 'gate';
  readonly description: string;
}

export const STATIONS: readonly Station[] = [
  {
    id: 'intake',
    label: 'Intake',
    cellGroup: 'product',
    description: 'PR 인입 — diff_hash + 변경 파일 list 수집 (forge-engine: intake)'
  },
  {
    id: 'spec',
    label: 'Spec',
    cellGroup: 'product',
    description: '요구사항 명세 — task title/description 분명화 (forge-engine: clarify + spec)'
  },
  {
    id: 'plan',
    label: 'Plan',
    cellGroup: 'build',
    description: '작업 계획 — 단위 분해 (forge-engine: context + harness-design + plan)'
  },
  {
    id: 'build',
    label: 'Build',
    cellGroup: 'build',
    description: 'work 수행 — diff 적용 (forge-engine: work, single-executor)'
  },
  {
    id: 'preverify',
    label: 'Preverify',
    cellGroup: 'quality',
    description: '6-axis 사전 체크 — structure/context/plan/execution/verification/improve (visualizer 전용)'
  },
  {
    id: 'deterministic-rules',
    label: 'Deterministic Rules',
    cellGroup: 'quality',
    description: 'rule pack 검증 — hardcoded-credential 등 critical pattern 차단 (forge-engine: quality-policy, wedge BLOCK 발생)'
  },
  {
    id: 'quality-contract',
    label: 'Quality Contract',
    cellGroup: 'quality',
    description: '품질 계약 점검 — failedBars 추적 (forge-engine: quality-contract)'
  },
  {
    id: 'quality-score',
    label: 'Quality Score',
    cellGroup: 'quality',
    description: '품질 점수 — overall vs minimumRequired (forge-engine: quality-score)'
  },
  {
    id: 'self-review',
    label: 'Self Review',
    cellGroup: 'review',
    description: '자기 검토 — 1차 sanity (forge-engine: self-review)'
  },
  {
    id: 'advisor-review',
    label: 'Advisor Review',
    cellGroup: 'review',
    description: 'Claude/Codex advisor opinion (verdict 아님) — forge-engine: codex-review + architecture-review + design-review (wedge LGTM 발생)'
  },
  {
    id: 'human-gate',
    label: 'Human Gate',
    cellGroup: 'gate',
    description: '사람 승인 — humanApprovalRequired 시 차단 (forge-engine: gate)'
  },
  {
    id: 'apply',
    label: 'Apply',
    cellGroup: 'gate',
    description: '최종 적용 — apply.allowed=true 시만 진행 (forge-engine: apply)'
  }
];

export const STATION_COUNT = STATIONS.length;
