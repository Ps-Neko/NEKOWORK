// codex runner 단독 live 검증 (P2-c).
//
// 환경: codex CLI (≥0.124) + ChatGPT 로그인 또는 OPENAI_API_KEY.
// 비용: 1회 호출 약 ~15K 토큰 (ChatGPT 구독 시 무과금).
//
// 사용:
//   node scripts/verify/codex-live.js
//
// 옵트인 env:
//   HARNESS_CODEX_PROFILE_REVIEW   ~/.codex/config.toml 의 review 프로파일 명
//   HARNESS_CODEX_PROFILE          공통 프로파일 (위가 없을 때 fallback)
//   HARNESS_CODEX_TIMEOUT_S        codex 호출 timeout (디폴트 180)
//
// 종료 코드: 0 = PASS, 1 = FAIL.
// codex CLI 메이저 업데이트 시 본 스크립트로 회귀 감지 권장.

import { runCodex } from '../agents/runners/codex.js';

const args = {
  stage: 'codex-review',
  context: {
    diff: "+ console.log('password:', password);\n+ const token = req.headers.authorization;\n+ db.query(`SELECT * FROM users WHERE id = ${userId}`);",
    priorHandoffs: [
      {
        stage: 'self-review',
        decided: 'approve',
        files: ['auth/login.js'],
        verdict: 'approve'
      }
    ],
    prd: {
      goal: 'login 디버그 로그 추가',
      acceptanceCriteria: [
        { id: 'ac-1', text: '로그인 실패 사유 식별 가능', passes: true }
      ]
    }
  }
};

try {
  const start = Date.now();
  const result = await runCodex(args);
  const ms = Date.now() - start;

  const issues = result.issues || [];
  const verdict = result.verdict;
  const validVerdicts = ['approve', 'approve_with_fixes', 'block'];
  if (!validVerdicts.includes(verdict)) {
    throw new Error(`unexpected verdict: ${verdict} (expected one of: ${validVerdicts.join(', ')})`);
  }

  console.log(JSON.stringify(result, null, 2));
  console.log(`\n[PASS] verdict=${verdict} issues=${issues.length} duration_ms=${ms}`);
  process.exit(0);
} catch (e) {
  console.error(`[FAIL] ${e.message}`);
  if (e.stack) console.error(e.stack);
  process.exit(1);
}
