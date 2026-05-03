# RUNBOOK

> 운영자(사람) · 자동화 · 외부 협업자가 동일한 절차로 HARNESS 를 다루기 위한 단일 책자.
> 누적 이력은 `docs/CHANGELOG.md` 와 `docs/dev-log/` 참조.

## 0. 사전 조건

- Node 22+ (확인: `node -v`)
- Git
- Bash (Windows 는 git-bash 또는 WSL2)
- (옵션) Codex CLI: `npm i -g @openai/codex`
- (옵션) Gemini CLI

### 0.1 LLM 인증 (구독 OAuth 위임)

자세한 정책은 `docs/AUTH-MIGRATION.md`. 요약:

```bash
claude login                            # Claude Pro / Max 구독 OAuth
codex auth login                        # ChatGPT 로그인 세션
gcloud auth application-default login   # Gemini / Vertex
```

> ⚠️ `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` / `GOOGLE_API_KEY`
> 가 환경에 set 되어 있으면 구독 OAuth 세션이 무시되어 종량제 과금으로
> 빠질 수 있습니다. `pre-bash-dispatcher` 가 자동 차단 — `unset <KEY>` 또는
> `HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1` 로 명시 옵트아웃.

`--live` 실행 중 provider 호출이 실패하면 기본값은 즉시 실패다. 예전처럼 mock fallback 을
허용해야 하는 CI/디버그 상황에서만 `HARNESS_LIVE_ALLOW_MOCK_FALLBACK=1` 을 명시한다.

### 0.2 GitHub 인증 (선택)

```bash
# OAuth App 등록 (한 번만, https://github.com/settings/developers)
export HARNESS_GITHUB_CLIENT_ID=<your_client_id>
npm run auth:github:login        # device flow → ~/.harness/oauth/github.json
npm run auth:github:status       # 검증
npm run auth:github:logout       # 폐기
```

CI 등 OAuth 가 어려운 환경은 `GITHUB_TOKEN` PAT fallback.

## 1. 초기 설치 (개발자 입장)

```bash
git clone <repo> harness
cd harness
npm install
./install.sh --plan --profile developer       # dry-run, 변경 없음
./install.sh --apply --profile developer       # 5 빌더 + state 기록
```

선택 가능한 profile/module/component/target 확인:
```bash
node scripts/install-plan.js --list
node scripts/install-plan.js --list --json
```

JSON 출력 (CI / 외부 도구):
```bash
node scripts/install-plan.js --profile developer --json > plan.json
```

특정 하네스만:
```bash
./install.sh --apply --harness claude
```

`--target`, `--module`, `--component`, `--without-*` 에 없는 이름을 넣으면 plan 단계에서 즉시 실패합니다.

## 2. 프로파일

| 프로파일 | 모듈 | 용도 |
|---|---|---|
| core | rules-core, agents-core, hooks-runtime, platform-configs | 최소 부팅 |
| developer (default) | core + workflow-quality + codex-loop | 일상 개발 |
| security | core + 보안 강화 (codex-challenge 자동) | 인증 / 결제 / PII |
| research | core + research agent + Gemini provider | 리서치 / 분석 |
| full | 전 모듈 | 모두 |

## 3. 매일 검증

```bash
# 카탈로그 무결성 + 4 validator
npm run lint                      # catalog.js + validate:all + security:hardening

# workflow / OIDC / dead-man / MCP pin / dependency hardening
npm run security:hardening

# 마커 무결성
node scripts/ci/check-markers.js

# 자동 영역 sync 정합
node scripts/sync-claude-md.js --check

# 빌드 산출물 sha256 정합
node scripts/repair.js --check

# 코드맵 최신 여부
node scripts/build-codemaps.js --check

# 테스트 (단위 + 통합 + e2e)
npm test
```

CI 한 줄:
```bash
npm run lint && npm test && npm audit --audit-level=moderate && node scripts/repair.js --check && node scripts/sync-claude-md.js --check && node scripts/build-codemaps.js --check
```

## 4. CLI 사용

```bash
# 설치 / 검증
harness install --plan --profile developer
harness install --plan --profile developer --project-root <dir>
harness install --apply --profile developer
harness install --apply --profile developer --project-root <dir>
harness validate
harness version

# 풀체인 리뷰
harness review "<task>"                       # 1~7 단계 자동
harness review "<task>" --secure              # codex-challenge 강제
harness review "<task>" --fast                # ideate / challenge 스킵
harness review "<task>" --no-ship             # ship 단계 생략
harness review "<task>" --no-codex            # codex-review / challenge 생략
harness review "<task>" --live                # 실 LLM 호출 (claude/codex/gcloud 로그인 세션 사용, §0.1)
harness review "<task>" --project-root <dir>  # 외부 프로젝트에 session/git 작업을 쓰고 HARNESS catalog 는 현재 설치 루트에서 읽음

# --fast 와 --secure 는 의미가 충돌하므로 함께 쓰면 실패

# 단독 단계
harness plan "<task>"                         # 1·2 만, implement 이전 stop
# self-review / codex-review 단독은 미구현 — review 풀사이클 사용

# 영속 / ralph (명시 옵트인)
harness ralph "<task>" [--max-iter 5]
harness team-lite "<task>" [--live] [--session <id>]
harness wait {start|stop|status}

# 운영
harness sessions
harness sessions --project-root <dir>
harness costs --since=7d
harness instincts {list|get <id>|promote <id>|prune|ready}
```

`team-lite` 는 OMC식 staged team pipeline 의 경량판이다. 실행 순서는
`team-plan → team-prd → team-exec → team-verify → team-fix` 이며,
`team-verify` 가 `approve` 를 반환하면 `team-fix` 는 `skipped` 로 닫힌다.
세션 산출물은 `.harness/state/sessions/<id>/team-lite.json`, `monitor.json`,
`heartbeat.jsonl`, `heartbeats/<stage>.json`, `handoffs/<NN>-team-*.{md,json}` 에 남는다.

## 5. 빌더 / repair / sync 사이클

매니페스트 (`agent.yaml` 또는 `agents/`, `skills/`, `hooks/hooks.json`, `manifests/`) 변경 시:

```bash
# 1. 매니페스트 수정 후
npm run lint                                  # 검증

# 2. 산출 갱신
./install.sh --apply                          # 5 빌더 + sha256 갱신
node scripts/sync-claude-md.js                # CLAUDE.md 자동 영역 갱신
node scripts/build-codemaps.js                # codemaps 갱신

# 3. 정합 확인
node scripts/repair.js --check                # 모든 하네스 정합
```

특정 하네스의 출력 디렉터리가 손상되면 `repair` 가 sha256 비교로 재빌드:

```bash
node scripts/repair.js                        # 변경분만 재빌드
node scripts/repair.js --harness cursor       # 특정 하네스만
node scripts/repair.js --force                # 전부 재빌드 (sha256 무시)
```

`repair` 는 `.harness/install-state.json` 을 schema 검증한 뒤 실행하며,
재빌드 후 `source_sha256` 과 `targets[].sha256` 을 모두 실 sha256 으로 다시 기록한다.
예전 placeholder hash 가 남아 있으면 `--check` 에서 부정합으로 보고한다.

## 6. 트러블슈팅

### Ajv 가 draft 2020-12 인식 못 함
```
Error: no schema with key or ref "https://json-schema.org/draft/2020-12/schema"
```
→ `import Ajv2020 from 'ajv/dist/2020.js'` 사용 (이미 적용됨).

### `node --test tests/unit/` (디렉터리) 가 동작 안 함
→ Node 22+ 의 `node --test` 는 디렉터리 글로빙 미지원. `tests/unit/*.test.js` 명시 또는 `npm test` 사용.

### Windows 에서 `install.sh` 동작 안 함
→ git-bash 또는 WSL2 필요. 또는 `pwsh ./install.ps1 --apply --profile developer`.

### tsc 가 PATH 에서 못 잡힘 (Windows)
→ `quality-gate` 의 `which()` 가 cwd 부터 부모 탐색. 임시 `.ts` 는 프로젝트 안에 두기.

### CRLF / LF 워닝
→ `.gitattributes` 가 LF 강제. 기존 워킹 트리에 CRLF 가 있으면 `git add --renormalize .` 한 번.

### npm install 실패
→ Node 22+ 인지 확인 (`node -v`), 회사 프록시 환경이면 `.npmrc` 에 registry 설정.

### MCP `notifications/initialized` timeout
→ smoke test 시 명시 (현재 OK). 외부 MCP 클라이언트가 호출하는 경우 확인.

## 7. CI / GitHub Actions

레포 push 후 자동 동작:

| 워크플로우 | 트리거 | 동작 |
|---|---|---|
| `.github/workflows/harness-validate.yml` | push, PR | catalog + validate:all + 단위 테스트 |
| `.github/workflows/harness-review.yml` | PR | 풀 7단계 자동 + 핸드오프 PR 코멘트 + 아티팩트 업로드 |

레포 미 push 상태에서 로컬로 흉내내기:
```bash
node scripts/demo-review.js "<task>" demo-local --no-ship
```

## 8. 사내 / 외부 프로젝트 이식

`docs/PORTING.md` 참조. 요약:

1. 대상 프로젝트 루트에 `.harness-tool/` 으로 결합 (submodule 또는 npm dep).
2. `node .harness-tool/scripts/install-plan.js --profile research --project-root .`.
3. 프로젝트별 룰은 `rules/<project>/` 로 추가 (common 위에 오버라이드).
4. CLAUDE.md 의 `<!-- HARNESS:START -->` 마커 영역만 자동 갱신, 사용자 영역 보존.
5. `node REPO_ROOT/scripts/portability/simulate-port.js <target> --profile research --verbose` 으로 dry-run 가능.
6. 대상 프로젝트 루트에서 `node .harness-tool/scripts/install-apply.js --profile research --project-root .` 로 하네스 산출물을 생성한다.
7. 대상 프로젝트 루트에서 `node .harness-tool/scripts/cli.js review "<task>" --no-ship` 를 실행한다.

대상 프로젝트 밖에서 실행해야 하면 `--project-root <target>` 또는 `HARNESS_PROJECT_ROOT=<target>` 를 쓴다.
이 경우 `agents/` / `schemas/` / 빌더 입력은 HARNESS 설치 루트에서 읽고, `.harness/state` / `.harness/install-state.json` / 하네스 출력 / git 작업은 대상 프로젝트에 기록된다.

## 9. 배포 (publish)

현재 `private: true` (npm publish 막힘). 공개 시:

1. `package.json` 의 `repository.url` 확인 — 현재 `Ps-Neko/NEKOWORK` 로 채워짐. 다른 조직으로 이전 시에만 갱신.
2. `private: true` → 제거 또는 `false`.
3. `npm version patch|minor|major` 로 SemVer 업.
4. `npm publish --access public`.
5. `docs/CHANGELOG.md` 갱신.

## 10. 진행 상태

상세 이력은 `docs/CHANGELOG.md` 와 `docs/dev-log/` 참조. 현재 상태 요약:

- 버전: 0.0.2 (2026-04-29 P1 회수)
- 카탈로그: 11 agents · 9 skills · 5 hooks · 7 modules · 5 profiles
- 5 빌더 모두 동작 + codemaps
- `npm test` PASS (unit + integration + e2e)
- 자체 완결 가능 영역 정합 100%
- 외부 의존 영역 (Gemini CLI live / GitHub OAuth 또는 push / npm publish) 은 사용자 동의 시점까지 보류

다음 우선순위는 `docs/AUDIT.md §5` 참조.
