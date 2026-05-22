# Post-Release Checklist — alpha.11

> alpha.11 출고 직후 ~ 1.0 후보 전환까지의 운영 절차.
> 코드 추가 작업이 아니라 **publish / 외부 검증 / 피드백 수집** 의 체크리스트.
> SCOPE-1.0.md §13.2 의 1.0 release gate 통과가 목표.

## 0. 사전 확인 (publish 전)

### 0.1 로컬 검증

- [x] git tag `v0.1.0-alpha.11` 로컬 생성 (커밋 `c8f55bd`)
- [ ] `npm test` 통과 (494/494)
- [ ] `npm run bench:rules` 5/5 PASS
- [ ] `npm run lint` 통과
- [ ] `npm audit --audit-level=moderate` 0 vulns
- [ ] `npm pack --dry-run --json` 정상

### 0.2 CI green 게이트 (publish 차단)

**로컬 PASS ≠ CI PASS.** `.gitignore` / 환경 변수 / fixture 경로 차이로 환경이 갈릴 수 있음. publish 전 다음 3개를 모두 확인:

- [ ] **마지막 1 commit CI 성공** — `gh run list --branch main --limit 1 --json conclusion --jq '.[0].conclusion'` 가 `success`
- [ ] **최근 5 commit CI 추세** — `gh run list --branch main --limit 5 --json conclusion --jq '[.[] | .conclusion] | join(",")'` 결과에 `failure` 가 1개라도 있으면 publish 금지. red streak 의 근본 원인을 먼저 잡고 다음 commit 으로 green 회복 확인 후 진행
- [ ] **fixture / `.gitignore` 변경이 있었다면 충돌 검토** — 새 fixture 가 시크릿 룰 (`*.pem` / `*.key` / `*.crt` / `*.p12` / `*.pfx` / `credentials*.json`) 에 차단되지 않는지 `git check-ignore <fixture-path>` 로 확인. 차단되면 `!tests/fixtures/**/<pattern>` 예외 룰 추가

> **2026-05-16 사고 (이 게이트의 도출 근거):** alpha.11 가 **CI red 6 commit streak** 상태에서 publish 됨. 원인: `.gitignore` 의 `*.pem` 룰이 secret-detection 룰 자체의 fixture (`positive/004-private-key.pem`, `negative/005-public-key.pem`) 까지 차단. 로컬 `npm test` 는 fixture 가 존재하므로 PASS, CI 체크아웃은 fixture 가 없어서 FAIL. **NEKOWORK 가 NEKOWORK 자신의 CI 를 깨뜨린 자기모순.** commit `6a0e862` 로 `.gitignore` 예외 + 두 synthetic fixture commit 으로 복구. 위 3개 게이트가 이 사고에서 도출됨. 다음 alpha 에서는 0.1 → 0.2 순서로 검증 후 publish.

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

> ✅ alpha.11 (2026-05-16) 에서 이미 완료. 다음 alpha publish 시 동일 패턴.

publish 직후 update 가 필요한 파일들:

- `README.md` Status 섹션: `Current npm alpha: ...` 라인 + `npm test N tests pass` 라인
- `README.ko.md` "현재 alpha 상태" 섹션: Current alpha + Tests 라인
- `docs/SETUP.md`: 첫 문단 published alpha 핀
- `docs/PORTING.md`: 첫 문단 published alpha 핀
- `docs/CHANGELOG.md`: `[0.1.0-alpha.X] - TBD` → `- YYYY-MM-DD`
- `docs/DEMO.md`: doctor example 의 alpha 버전 라인 (version-consistency.test.js 가 SVG + README 와 교차 검증)
- `docs/assets/demo-terminal.svg`: package metadata 의 alpha 버전 (version-consistency.test.js 가 README 의 npmAlpha 와 일치 강제)
- `WORKING-CONTEXT.md`: 버전 라인 ("repo + npm alpha 동기" 표현으로)
- `tests/unit/version-consistency.test.js`: `Tests: N` assertion 의 N 갱신

## 3. Smoke test (publish 직후)

새 임시 디렉토리에서. **중요**: 베이스 파일만 먼저 commit 하고, AI 가 만들었을 법한
위험 변경은 untracked / unstaged 로 남겨야 verify-pr 의 working-tree 모드가
그 변경을 잡습니다 (diff-parser 가 ls-files --others 로 untracked 도 흡수).
전부 한 번에 `git add -A` 하면 diff 가 비어서 ALLOW 가 됩니다.

```bash
TMP=$(mktemp -d) && cd "$TMP"
git init -q && git config user.email t@t && git config user.name t

# 1. 베이스만 commit (untracked 가 working-tree diff 에 들어가도록)
echo '{"name":"smoke","scripts":{"test":"echo ok"}}' > package.json
git add package.json && git commit -q -m init

# 2. AI 가 만들었을 법한 위험 변경 — untracked 로 둠
mkdir -p src
cat > src/auth.ts <<'EOF'
export const k = process.env.API_KEY || "sk-leaked-fallback-test";
EOF

# 3. verify-pr 실행
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
