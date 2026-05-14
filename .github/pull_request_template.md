<!--
NEKOWORK PR template. 한국어 또는 영어 모두 환영.
큰 변경은 먼저 issue 로 토론해주세요. 자세한 컨벤션: CONTRIBUTING.md.
-->

## Summary

<!-- 무엇이 / 왜. 1~3 줄. -->

## Type

<!-- feat | fix | refactor | docs | test | chore | perf | ci -->

## Handoff 5필드

> 작은 docs/chore 변경이면 비워두거나 한 줄 요약만 적어도 됩니다.

- **Decided**:
- **Rejected**:
- **Risks**:
- **Files**:
- **Remaining**:

## Test plan

- [ ] `npm run lint` pass (catalog + 4 validator + check-version)
- [ ] `npm test` pass (관련 영역 단위/통합/e2e)
- [ ] manual smoke (해당 시): `node scripts/cli.js <command> ...`

## Release / safety impact

- [ ] 사용자 facing CLI 표면 변경 없음 (또는 README / docs 업데이트 포함)
- [ ] 자동 commit / push / publish / deploy / apply 부재 보존
- [ ] `decision.json` / `REPORT.md` 계약 보존 (해당 시)
- [ ] `.harness/state/` 호환성 보존 (해당 시)

## Linked issues / context

<!-- closes #N / refs #N / 외부 분석 링크 등 -->
