<!--
NEKOWORK PR template. 한국어 또는 영어 모두 환영.
큰 변경은 먼저 issue 로 토론해주세요. 자세한 컨벤션: CONTRIBUTING.md.
-->

## Summary

(변경의 핵심 1-2줄)

## Type

- [ ] Rule 추가 (`packages/nekowork/scripts/lib/rules/<name>.js`)
- [ ] Rule 패턴 보강 (false positive / negative 시드 추가)
- [ ] Bug fix
- [ ] Docs / README
- [ ] CI / 배포
- [ ] 기타

## Test plan

- [ ] `cd packages/nekowork && node --test tests/unit/*.test.js` PASS
- [ ] (rule 변경 시) `tests/fixtures/<rule>/manifest.json` recall ≥ 0.90, CRITICAL FP rate ≤ 0.10
- [ ] (CLI 변경 시) `node scripts/cli.js --version`, `verify-pr --help`, `smoke`, `smoke:reject` 확인
- [ ] (CI 변경 시) GitHub Actions / pre-commit hook 동작 검증

## brief 가드레일 self-check

- [ ] 새 기능 추가 0개 — 추가가 있다면 정확히 무엇이 추가됐는지 명시
- [ ] 사용자 대면 문서에 내부 용어 미도입 (NEKO 세계관 / 14단계 / harness 등)
- [ ] 60초 try 경로 영향 없음 (`npx -y @ps-neko/nekowork verify-pr`)
- [ ] auto-commit / auto-push / auto-deploy 도입 없음

## Linked issues / context

<!-- closes #N / refs #N / 외부 분석 링크 등 -->
