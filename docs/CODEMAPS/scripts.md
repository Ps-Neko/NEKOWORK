# CODEMAP — scripts

> 자동 생성. `scripts/build-codemaps.js` 가 `scripts/` 를 스캔. 직접 편집 금지.
> 코드 본문은 포함 안 함. 네비게이션 보조용.

## 디렉터리 트리

```
scripts/
├── agents/
│   ├── runners/
│   │   ├── claude.js
│   │   ├── codex.js
│   │   ├── gemini.js
│   │   └── mock.js
│   └── dispatch.js
├── auth/
│   ├── github-import-gh.js
│   ├── github-login.js
│   ├── github-logout.js
│   └── github-status.js
├── ci/
│   ├── catalog.js
│   ├── check-markers.js
│   ├── validate-agents.js
│   ├── validate-hooks.js
│   ├── validate-manifests.js
│   └── validate-skills.js
├── core/
│   ├── auth-guard.js
│   ├── cli-resolver.js
│   ├── execution-workspace.js
│   ├── git-mutation-guard.js
│   ├── json-extractor.js
│   └── subprocess.js
├── daemon/
│   └── wait.js
├── lib/
│   ├── costs.js
│   ├── instincts.js
│   ├── keychain.js
│   ├── router.js
│   ├── severity.js
│   └── token-vault.js
├── orchestrators/
│   ├── ralph.js
│   ├── review.js
│   └── team-lite.js
├── portability/
│   └── simulate-port.js
├── verify/
│   ├── claude-live.js
│   ├── codex-live.js
│   └── gemini-live.js
├── build-claude.js
├── build-codemaps.js
├── build-codex.js
├── build-cursor.js
├── build-gemini.js
├── build-opencode.js
├── cli.js
├── demo-review.js
├── install-apply.js
├── install-plan.js
├── repair.js
└── sync-claude-md.js
```

## 핵심 export

| 파일 | export | 설명 |
|---|---|---|
| `agents/dispatch.js` | `dispatch`, `loadAgentFrontmatter` | 에이전트 dispatch. agent.md frontmatter 읽고 provider runner 로 위임. 입력 / 출력은 표준화된 JSON 스키마. 단계 간 컨텍스트는 핸드오프 파일로만. |
| `agents/runners/claude.js` | `buildCliArgs`, `buildSystem`, `buildUserMessage`, `extractJson`, `normalizeCliUsage`, `parseCliJson`, `runClaude` | Claude runner. Default live mode uses the local Claude Code CLI subscription/OAuth session. Set HARNESS_CLAUDE_RUNNER=sd |
| `agents/runners/codex.js` | `buildPrompt`, `extractJson`, `normalizeHandoff`, `runCodex` | Codex runner: OpenAI Codex CLI 를 subprocess 로 호출. 환경: codex 바이너리 필요. 없으면 throw.  호출 패턴 (codex 0.124.0+ 비대화형 검증):   codex |
| `agents/runners/gemini.js` | `buildCliArgs`, `buildPrompt`, `parseGeminiOutput`, `runGemini` | Gemini runner: calls the local Gemini CLI subprocess. Default auth is delegated to the user's local gemini/gcloud sessio |
| `agents/runners/mock.js` | `runMock` | Mock runner: LLM 호출 없이 결정론적 응답 생성. 오케스트레이터 단위 테스트와 API 키 / CLI 미설치 환경에서의 dry-run 디폴트.  단계별로 의도된 시나리오를 흉내낸다:   - planner: |
| `auth/github-import-gh.js` | _(none)_ | Import the already-authenticated GitHub CLI OAuth token into the HARNESS vault. This is an explicit local-session bridge |
| `auth/github-login.js` | _(none)_ | GitHub OAuth Device Flow. 사전 조건: HARNESS_GITHUB_CLIENT_ID 환경변수 (사용자가 자기 OAuth App 등록 후 받은 client_id). 자세한 절차는 docs/AUTH- |
| `auth/github-logout.js` | _(none)_ | GitHub OAuth 로그아웃. 로컬 vault 만 삭제. 주의: device flow 는 client secret 이 없으므로 GitHub 측 revoke API 호출 불가. GitHub 측에서도 폐기하려면 사용 |
| `auth/github-status.js` | _(none)_ | GitHub OAuth 상태 점검. vault 에 토큰이 있고 GitHub API 가 응답하는지 확인. |
| `build-claude.js` | _(none)_ | 정규 카탈로그 (agents/, skills/, commands/, hooks/) → .claude/ 로 투영. Claude Code 가 인식하는 디렉터리 레이아웃 + .claude-plugin/plugin.json |
| `build-codemaps.js` | _(none)_ | docs/CODEMAPS/<area>.md 자동 생성. 디렉터리 트리(파일 목록) + 각 .js / .mjs 의 핵심 export(엔트리 함수) 를 추출. 코드 본문은 포함하지 않는다 (네비게이션 보조). |
| `build-codex.js` | _(none)_ | 정규 카탈로그 → .codex/ 로 투영. Codex CLI 형식: config.toml + agents/*.toml. |
| `build-cursor.js` | _(none)_ | 정규 카탈로그 → .cursor/ 로 투영. Cursor 형식: .cursor/rules/*.mdc (공식), .cursorrules (legacy 공유 룰). 이벤트 어댑터: hook 의 PreToolUse/Pos |
| `build-gemini.js` | _(none)_ | 정규 카탈로그 → .gemini/ 로 투영. Gemini 형식: 요약 중심 (output_format: summary). 풀 본문은 정규 카탈로그를 참조. GEMINI.md 가 단일 진입점, 스킬은 descripti |
| `build-opencode.js` | _(none)_ | 정규 카탈로그 → .opencode/ 로 투영. opencode 형식: JSON 단일 설정 (config_format: json). agents/skills/hooks 를 모두 JSON 배열로 합성. |
| `ci/catalog.js` | _(none)_ | 정규 카탈로그 무결성 체크. agent.yaml 의 agents/skills/commands 가 실제 파일과 일치하는지, 모듈이 누락 없이 컴포넌트를 참조하는지. |
| `ci/check-markers.js` | _(none)_ | HARNESS:START / HARNESS:END 마커 무결성 검증. 사용자 작성 영역과 자동 갱신 영역 사이가 짝지어져 있는지. |
| `ci/validate-agents.js` | _(none)_ | agents/<name>.md frontmatter 가 schemas/agent.schema.json 을 만족하는지 검증. agent.yaml 의 agents 목록과 실 파일 일치 여부도 체크. |
| `ci/validate-hooks.js` | _(none)_ | hooks/hooks.json 이 schemas/hooks.schema.json 을 만족하고 참조하는 스크립트 파일이 실제 존재하는지 검증. |
| `ci/validate-manifests.js` | _(none)_ | agent.yaml + manifests/install-{profiles,modules,components}.json 검증. 1) 각 파일 schema 통과 2) 프로파일 → 모듈 → 컴포넌트 그래프의 참조 무결성 |
| `ci/validate-skills.js` | _(none)_ | skills/<name>/SKILL.md frontmatter 가 schemas/skill.schema.json 을 만족하는지 검증. agent.yaml 의 skills 목록과 실 디렉터리 일치 여부도 체크. |
| `cli.js` | _(none)_ | HARNESS CLI 진입점. 10 verb: install / validate / review / plan / self-review / codex-review / ralph / wait / sessions / co |
| `core/auth-guard.js` | ` BLOCKED_ENV `, `assertDelegatedCliAuth` |  |
| `core/cli-resolver.js` | `assertProviderCliTrust`, `isPathInside`, `resolveCli`, `resolveProviderCli` |  |
| `core/execution-workspace.js` | `applyExecutionDiff`, `captureExecutionDiff`, `changedFiles`, `withExecutionWorkspace` |  |
| `core/git-mutation-guard.js` | `readGitStatus`, `withGitMutationGuard` |  |
| `core/json-extractor.js` | `extractJson`, `parseJsonObject` |  |
| `core/subprocess.js` | `spawnAndCollect` |  |
| `daemon/wait.js` | _(none)_ | `harness wait --start` 영속 데몬. 동작:   - .harness/state/sessions/*/wakeup.json 폴링 (10초 간격).   - 발견 시 해당 세션의 ralph 또는 review |
| `demo-review.js` | _(none)_ | claude-led-codex-review 풀사이클 시뮬레이션 (Week 1 데모). 실제 LLM 호출은 안 함 — 7단계의 핸드오프 파일 / 상태 / round 카운터가 잘 흐르는지만 검증. 사용자 룰("git p |
| `install-apply.js` | _(none)_ | HARNESS install --apply : plan 단계 검증 → harness 별 빌드 (agent.yaml harnesses 전부) → install-state 기록 → 마커 검증. 멱등(idempotent) |
| `install-plan.js` | `plan` | HARNESS install --plan: dry-run manifest planner. |
| `lib/costs.js` | `list`, `record`, `summarize` | 비용 트래커. 매 도구 호출 후 모델·토큰·USD 추정값을 ~/.harness/costs.jsonl 에 append. CLI 조회: harness costs --since=7d (또는 --since=1h, 30m,  |
| `lib/instincts.js` | `get`, `list`, `promote`, `prune`, `ready`, `record` | continuous-learning-v2 인스팅트 시스템. 매 review 사이클 후 발견된 패턴 (라우팅 결정 + 이슈 카테고리 + verdict 흐름) 을 신뢰도 점수와 함께 ~/.harness/instincts |
| `lib/keychain.js` | `get`, `isAvailable`, `list`, `remove`, `set` | scripts/lib/keychain.js OS keychain wrapper (@napi-rs/keyring sync API). macOS Keychain / Windows Credential Manager / L |
| `lib/router.js` | `decide`, `trace` | 라우팅 결정 라이브러리. 입력: stage, task, files, ecoMode, riskLevel 출력: { agent, model, provider, rationale, alternatives }  SKILL  |
| `lib/severity.js` | `classifyCategory`, `classifySeverity`, `deriveVerdict`, `riskLevel`, `severityCounts` | Severity / category 분류 + blast radius 계산. REVIEW.md 의 분류 규칙을 코드로 옮긴 것. 단위 테스트 가능. |
| `lib/token-vault.js` | `audit`, `backend`, `list`, `load`, `redact`, `remove`, `save` | scripts/lib/token-vault.js auth.token_store: os-keychain (default) 또는 encrypted-file. 백엔드 결정:   HARNESS_TOKEN_STORE_KIND |
| `orchestrators/ralph.js` | `ralphLoop` | ralph 영속 루프. PRD AC 가 모두 PASS 될 때까지 review 사이클 반복. 명시 호출 전용. 매직 키워드 자동 활성 안 함. |
| `orchestrators/review.js` | `SENSITIVE_PATTERNS`, `reviewCycle` | 7단계 review 오케스트레이터. claude-led-codex-review SKILL 의 Stage Routing 표를 코드로 구현.  핵심 규칙:   - 단계 5/6 의 verdict 가 block 또는 cri |
| `orchestrators/team-lite.js` | `teamLiteCycle` |  |
| `portability/simulate-port.js` | _(none)_ | PoC 이식 시뮬레이터. PORTING.md 의 30분 절차를 dry-run 으로 검증.  입력: --target <대상 디렉터리>  (사용자가 지정한 사내 프로젝트 경로)       --profile <name>  |
| `repair.js` | _(none)_ | HARNESS repair : install-state.json 과 실 디스크의 빌드 산출물을 비교해 누락 / sha256 불일치인 하네스만 다시 빌드한다. install-apply 의 경량판.  - state 파일 |
| `sync-claude-md.js` | _(none)_ | CLAUDE.md / .claude/CLAUDE.md 의 HARNESS:START~HARNESS:END 영역을 agent.yaml + package.json + manifests 에서 다시 생성해 갈아낀다. 사용자  |
| `verify/claude-live.js` | _(none)_ | Claude Code CLI live smoke. Uses the local Claude subscription/OAuth session by default, not ANTHROPIC_API_KEY. |
| `verify/codex-live.js` | _(none)_ | codex runner 단독 live 검증 (P2-c).  환경: codex CLI (≥0.124) + ChatGPT 로그인 세션. OPENAI_API_KEY 는 기본 차단되며, 종량제 opt-in 때만 HARNES |
| `verify/gemini-live.js` | _(none)_ | Gemini CLI live smoke. Uses the local Gemini/gcloud session by default, not GEMINI_API_KEY. |

