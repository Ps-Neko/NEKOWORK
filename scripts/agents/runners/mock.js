// Mock runner: LLM 호출 없이 결정론적 응답 생성. 오케스트레이터 단위 테스트와
// API 키 / CLI 미설치 환경에서의 dry-run 디폴트.
//
// 단계별로 의도된 시나리오를 흉내낸다:
//   - planner: AC 3개의 PRD 시드
//   - executor: 작업 완료 보고
//   - code-reviewer: round 1 에서 high 1 발견 (fix loop 유도), round 2 에서 approve
//   - codex-reviewer: medium 1 추가 발견 후 approve_with_fixes
//   - codex-challenger: info 1 발견 후 approve
//   - doc-writer: ship 보고

export async function runMock({ agent, stage, task, context }) {
  const round = context.round || 1;

  switch (stage) {
    case 'ideate':
      return {
        decided: `"${task}" 의 후보 접근 비교. 라이브러리 X 채택.`,
        rejected: '자체 구현(유지보수 부담)',
        risks: '엣지 케이스 미식별',
        files: [],
        remaining: 'planner 에 PRD 시드 핸드오프',
      };

    case 'plan':
      return {
        decided: `${task} 를 AC 3개로 분해. TDD 강제.`,
        rejected: '범위 확장(키 회전 / 리프레시 토큰 = non-goal)',
        risks: '의존성 라이브러리 호환',
        files: ['prd.json'],
        remaining: 'executor 에 핸드오프',
        prdSeed: {
          task,
          acceptance: [
            { id: 'AC-001', desc: '핵심 기능 happy path', passes: false },
            { id: 'AC-002', desc: '실패 케이스 거절', passes: false },
            { id: 'AC-003', desc: '경계 / 잘못된 입력 거절', passes: false },
          ],
          non_goals: ['키 회전', '리프레시 토큰'],
        },
      };

    case 'implement':
      return {
        decided: `TDD ${context.acCount || 3} 사이클. AC 모두 GREEN. quality-gate 통과.`,
        files: ['src/<area>/<module>.ts', 'tests/unit/<module>.test.ts'],
        remaining: 'self-review',
      };

    case 'self-review':
      if (round === 1) {
        return {
          decided: 'high 1, medium 1 발견. fix loop 진입.',
          files: ['src/<area>/<module>.ts'],
          remaining: 'fix loop',
          issues: [
            { severity: 'high', category: 'security', file: 'src/<area>/<module>.ts', line: 23,
              summary: '입력 검증 누락', why: '경계 케이스를 거절하지 않음' },
            { severity: 'medium', category: 'test', file: 'tests/unit/<module>.test.ts',
              summary: 'happy path 외 커버리지 부족', why: '실패 케이스 단언 없음' },
          ],
          verdict: 'approve_with_fixes',
          confidence: 0.85,
        };
      }
      return {
        decided: '이전 high 해결. 추가 발견 0건.',
        files: ['src/<area>/<module>.ts'],
        remaining: 'codex-review',
        verdict: 'approve',
        confidence: 0.92,
      };

    case 'codex-review':
      return {
        decided: 'self-review 와 일치. 추가 medium 1 (timeout 미설정).',
        files: ['src/<area>/<module>.ts'],
        remaining: '--secure 시 단계 6, 아니면 단계 7',
        issues: [{ severity: 'medium', category: 'correctness',
          file: 'src/<area>/<module>.ts',
          summary: 'fetch timeout 미설정', why: '무한 대기 가능' }],
        verdict: 'approve_with_fixes',
        confidence: 0.88,
      };

    case 'codex-challenge':
      return {
        decided: '적대적 시나리오 5건 검토. 신규 critical 0, high 0, info 1.',
        files: [],
        remaining: 'ship',
        issues: [{ severity: 'info', category: 'security',
          summary: 'replay 방어 권장 (현 PRD non-goal)', why: 'jti / replay cache 향후 고려' }],
        verdict: 'approve',
        confidence: 0.95,
      };

    case 'ship':
      return {
        decided: 'CHANGELOG 갱신, PR 본문 한국어 초안 작성. 자동 push 안 함 (사용자 룰).',
        files: ['docs/CHANGELOG.md', 'WORKING-CONTEXT.md'],
        remaining: '사용자 검토 후 gh pr create 또는 git push 수동',
      };

    default:
      throw new Error(`unknown stage: ${stage}`);
  }
}
