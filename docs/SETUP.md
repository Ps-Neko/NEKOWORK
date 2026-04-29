# SETUP

> 외부 컨트리뷰터 / 다른 머신 셋업 가이드. P2 외부 의존 항목별 검증 절차 포함.

## 사전 요구

- Node ≥ 22.0.0 (테스트는 24.14.0)
- npm
- git

## 기본 설치 (코드만 동작 — mock provider 풀사이클)

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git harness
cd harness
npm ci
npm test                                          # 73/73 PASS 기대
node scripts/install-plan.js --profile core      # 설치 dry-run
```

이 시점에서 `harness review --no-ship` 등 mock 풀사이클이 모두 동작합니다. 외부 LLM 호출 없음.

## P2 외부 의존 항목별 셋업

### 1. Codex CLI live 검증 (가장 자립적 — 권장 시작점)

```bash
# CLI 설치
npm install -g @openai/codex

# 인증 (택1)
codex login                                       # ChatGPT 인증 (구독 필요, 토큰 무과금)
# 또는
export OPENAI_API_KEY="sk-..."                   # API 키 (토큰 과금)

# 회귀 검증 (~25s, ~15K 토큰)
npm run verify:codex
```

호환 버전: codex CLI ≥ 0.124.0. `codex exec --sandbox read-only` 비대화형 호출 사용.

> ℹ️ codex CLI 0.125.0 기준 stdout 형식이 `user\n<prompt echo>\n\ncodex\n<응답>` 으로 변경됨.
> `scripts/agents/runners/codex.js` 의 `runCodex` 가 `\ncodex\n` 라벨 이후만 파싱하도록 처리.

### 2. Anthropic SDK live (Claude 단계 활성화)

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
node scripts/cli.js review "<task>" --live --no-ship
```

비용: 1회 풀사이클 약 ~$0.10 (PRD 사이즈 의존). 키 미설정 시 자동 mock 폴백.

### 3. Gemini CLI live (research agent)

```bash
# Google 공식 Gemini CLI 설치 후
export GEMINI_API_KEY="..."
# 또는 gcloud auth application-default login
```

전용 회귀 검증 스크립트는 미작성 (향후 `npm run verify:gemini` 추가 예정).

### 4. Rust runtime 컴파일

```bash
# rustup 설치 (https://rustup.rs)
cd runtime
cargo build --release
./target/release/harness-runtime --help
```

주의: Node 데몬(`harness wait`)과 동시 실행 금지. 둘 다 wakeup.json 폴링.

### 5. GitHub Actions live (PR 자동 7단계 리뷰)

```bash
# 레포 secret 등록 (관리자만)
gh secret set ANTHROPIC_API_KEY -R <owner>/<repo>
```

이후 PR 생성 시 `harness-review` workflow 가 7단계 풀사이클 자동 적용 + handoff 아티팩트 업로드 + PR 코멘트.

## 알려진 이슈

### `.github/workflows/` push 시 OAuth 스코프 거부

- 원인: gh CLI 디폴트 토큰의 `repo` 스코프만으로는 workflow 파일 push 불가. `workflow` 스코프 필요
- 회피 (권장): GitHub 웹 UI 에서 `Add file → Create new file` 로 `.github/workflows/<name>.yml` 직접 생성
- `gh auth refresh -s workflow` 는 환경에 따라 동의 후에도 토큰 스코프 미반영 케이스 보고됨 (gh keyring 캐시 문제 추정)

## 다음 단계

- 부채 / 우선순위: `docs/AUDIT.md`
- 운영 절차: `docs/RUNBOOK.md`
- 사내 결합: `docs/PORTING.md`
- 통합 설계: `docs/ARCHITECTURE.md`
