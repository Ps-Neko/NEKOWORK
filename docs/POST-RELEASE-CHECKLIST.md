# Post-Release Checklist — alpha.11

> alpha.11 출고 직후 ~ 1.0 후보 전환까지의 운영 절차.
> 코드 추가 작업이 아니라 **publish / 외부 검증 / 피드백 수집** 의 체크리스트.
> SCOPE-1.0.md §13.2 의 1.0 release gate 통과가 목표.

## 0. 사전 확인 (publish 전)

- [x] git tag `v0.1.0-alpha.11` 로컬 생성 (커밋 `c8f55bd`)
- [ ] `npm test` 통과 (494/494)
- [ ] `npm run bench:rules` 5/5 PASS
- [ ] `npm run lint` 통과
- [ ] `npm audit --audit-level=moderate` 0 vulns
- [ ] `npm pack --dry-run --json` 정상

## 1. Publish (사용자 수동)

```bash
# alpha.11 publish — npm 인증 필요 (사용자 본인)
npm publish --tag alpha

# tag origin push
git push origin v0.1.0-alpha.11
```

검증:

```bash
# 60초 후 확인
npm view @ps-neko/nekowork@0.1.0-alpha.11 version
npx -y @ps-neko/nekowork@alpha --version
```

## 2. README 즉시 갱신 (publish 직후 1 commit)

`README.md` 의 Status 섹션 라인 한 줄:

```diff
- Current repository version: `0.1.0-alpha.11` · Current npm alpha: `@ps-neko/nekowork@0.1.0-alpha.10` (published 2026-05-14, `@alpha` dist-tag).
+ Current repository version: `0.1.0-alpha.11` · Current npm alpha: `@ps-neko/nekowork@0.1.0-alpha.11` (published <YYYY-MM-DD>, `@alpha` dist-tag).
```

`docs/SETUP.md` 와 `docs/PORTING.md` 의 첫 문단도 같이 갱신:

```diff
- The published `@ps-neko/nekowork@alpha` package points at `0.1.0-alpha.10` until alpha.11 is published.
+ The published `@ps-neko/nekowork@alpha` package points at `0.1.0-alpha.11`.
```

`docs/CHANGELOG.md` 의 `[0.1.0-alpha.11] - TBD` → `- YYYY-MM-DD`.

## 3. Smoke test (publish 직후)

새 임시 디렉토리에서:

```bash
mkdir /tmp/neko-smoke && cd $_ && git init -q && git config user.email t@t && git config user.name t
echo '{"name":"smoke","scripts":{"test":"echo ok"}}' > package.json
git add -A && git commit -q -m init

# 1. AI 가 만들었을 법한 위험 변경
cat > src/auth.ts <<'EOF'
export const k = process.env.API_KEY || "sk-leaked-fallback-test";
EOF

# 2. verify-pr 실행
npx -y @ps-neko/nekowork@alpha verify-pr

# 3. 기대: verdict BLOCK, exit 2, REPORT.md 와 decision.json 생성
echo "exit=$?"
cat REPORT.md
cat .nekowork/decision.json
```

PASS 기준:
- `verdict: BLOCK`
- `apply_allowed: false`
- `REPORT.md` 의 30초 안에 verdict + reason 확인 가능
- exit code 2

## 4. 외부 알파 모집 시작 (사용자 수동)

`docs/ALPHA-RECRUITMENT.md` 의 Pasteable Template 사용. 우선순위:

1. **직접 아는 AI 코딩 사용자 1-2명** — warm signal, 빠른 실측
   채널: DM / Slack / Discord
2. **r/cursor 또는 r/ClaudeAI** — 정확한 타겟, cold
   주의: HN Show 는 보류 (verify-pr recall 0.90 이 합성 코퍼스 기준이라 1.0 release 까지 아낌)
3. **GeekNews (한국)** — 한국 dev 커뮤니티
   주의: 채널별 메시지는 ALPHA-RECRUITMENT.md 참고

5명 채우는 게 목표가 아니라 각 채널에서 1명씩이라도 응답받는 게 신호.

## 5. 피드백 수집 (7일)

GitHub Issue template (`.github/ISSUE_TEMPLATE/alpha-feedback.yml`) 로 받기. 항목:

| 항목 | 설명 |
|---|---|
| Project type | open source / SaaS / internal / etc. |
| AI tool | Cursor / Claude Code / Codex / other |
| Diff size | added/deleted lines |
| Verdict | ALLOW / NEEDS_REVIEW / BLOCK / ... |
| 판정 맞음 | yes / no / partial |
| 오탐 | 어떤 finding, 어떤 맥락 |
| 미탐 | 무엇이 빠져나갔는지 |
| REPORT 이해 시간 | 30초 / 3분 / 10분+ |
| 다시 쓸 의향 | yes / no / depends |
| 혼란/누락 | free text |

수집한 diff 는 (가능한 경우) `tests/fixtures/` 에 source 속성과 함께 추가:
- `source: "ai-generated:claude-code-<date>"` 또는
- `source: "github:owner/repo@sha:path"` (PR 의 일부였다면)

이게 SCOPE-1.0 §9 의 stage 2/3 fixture 의 진짜 출처.

## 6. recall 재측정 (실제 AI-generated diff 추가 후)

```bash
npm run bench:rules
```

각 rule 의 manifest 가 stage 2/3 fixture 로 늘어난 뒤 측정값을 기록.
합성 seed 만의 100% / 90% 는 마케팅 숫자이지 1.0 신뢰 숫자가 아님.

목표 (SCOPE-1.0 §9):
- Secret Fallback recall ≥ 0.90 on real-world corpus
- CRITICAL FP rate ≤ 0.10 on real-world corpus
- 전체 corpus 30+ positive / 50+ negative, synthetic 비율 ≤ 30%

## 7. 1.0 전환 결정 (SCOPE-1.0 §13.2)

다음 모두 충족 시 1.0 release 후보:

```text
[ ] 내부 fixture benchmark Secret Fallback recall ≥ 0.90, FP ≤ 0.10
    + CI 3일 연속 PASS
[ ] 외부 알파 3/5 명 "다시 쓰겠다" 응답
[ ] CRITICAL 미탐 0건 (또는 모두 수정 완료)
[ ] 치명적 오탐 패턴 모두 수정 완료
[ ] 실제 AI-generated diff 에서 Secret Fallback recall 재측정 통과
```

미충족 시 alpha.12 / alpha.13 으로 이어가며 위 조건 충족까지 반복.

## 절대 금지 (post-release)

- 코드 추가 X — 외부 피드백 없이 추측으로 룰 늘리지 않음
- scope 확장 X — verify-skill / verify-release / OS 비전 hero 등재 등 모두 1.x
- "1.0 곧 출시" 류 마케팅 X — 외부 게이트 통과 전까지 alpha
