/**
 * 12-station verification factory — Phase 1.0 자연 선정.
 *
 * forge-engine 의 14단계 공정 (FACTORY-CELLS.md) 중 visualizer 의 wedge frame
 * 전달에 필수인 12개를 추렸다. station 6 (Deterministic Rules) 가 NEKOWORK
 * BLOCK 발생 지점, station 10 (Advisor Review) 가 LGTM 발생 지점이라 두 station
 * 이 same frame 에서 conflict 시각화 (design doc Path 2).
 *
 * 정합성 후속: plan T15 (design doc patch) + T16 (TODOS:VIZ-STATION-MAP) 에서
 * forge-engine 14단계와 1:1 매핑 lock.
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
    description: 'PR 인입 — diff_hash + 변경 파일 list 수집'
  },
  {
    id: 'spec',
    label: 'Spec',
    cellGroup: 'product',
    description: '요구사항 명세 — task title + description 분명화'
  },
  {
    id: 'plan',
    label: 'Plan',
    cellGroup: 'build',
    description: '작업 계획 — 단위 분해'
  },
  {
    id: 'build',
    label: 'Build',
    cellGroup: 'build',
    description: 'work 수행 — diff 적용'
  },
  {
    id: 'preverify',
    label: 'Preverify',
    cellGroup: 'quality',
    description: '6-axis 사전 체크 — structure/context/plan/execution/verification/improve'
  },
  {
    id: 'deterministic-rules',
    label: 'Deterministic Rules',
    cellGroup: 'quality',
    description: 'rule pack 검증 — hardcoded-credential 등 critical pattern 차단'
  },
  {
    id: 'quality-contract',
    label: 'Quality Contract',
    cellGroup: 'quality',
    description: '품질 계약 점검 — failedBars 추적'
  },
  {
    id: 'quality-score',
    label: 'Quality Score',
    cellGroup: 'quality',
    description: '품질 점수 — overall vs minimumRequired'
  },
  {
    id: 'self-review',
    label: 'Self Review',
    cellGroup: 'review',
    description: '자기 검토 — 1차 sanity'
  },
  {
    id: 'advisor-review',
    label: 'Advisor Review',
    cellGroup: 'review',
    description: 'Claude/Codex advisor — opinion (verdict 아님)'
  },
  {
    id: 'human-gate',
    label: 'Human Gate',
    cellGroup: 'gate',
    description: '사람 승인 — humanApprovalRequired 시 차단'
  },
  {
    id: 'apply',
    label: 'Apply',
    cellGroup: 'gate',
    description: '최종 적용 — apply.allowed=true 시만 진행'
  }
];

export const STATION_COUNT = STATIONS.length;
