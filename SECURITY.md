# Security Policy

## Reporting a Vulnerability

보안 취약점은 **공개 issue 로 보고하지 마세요**. 대신:

1. 레포 owner 에게 직접 연락 (GitHub private security advisory)
2. 또는 GitHub Issues 에서 "Private vulnerability reporting" 활성화 시 그 채널

응답 SLA: 보고 후 48시간 내 acknowledge, 영향 평가 후 수정 일정 공유.

## 위협 모델

HARNESS 는 LLM 에이전트 도구입니다. 다음 위협 영역을 인지합니다.

### 1. Prompt injection
- LLM 에 전달되는 외부 입력 (파일 / 웹 / 사용자 메시지) 은 모두 잠재적 명령으로 간주.
- `gateguard-fact-force` hook 이 Edit / Write 직전 사실 조사를 강제하여 self-evaluation 우회를 차단.
- `config-protection` hook 이 `.env`, `*.pem`, `credentials*` 등 시크릿 경로 직접 편집 차단.

### 2. Code execution
- `pre-bash-dispatcher` 가 위험 패턴 차단 (force push, rm -rf, --no-verify, curl|bash 등).
- `quality-gate` 가 변경 파일 타입 체크 후 차단.
- Codex / Gemini provider 는 read-only sandbox + outbound network 차단으로 호출.

### 3. Supply chain
- MCP 서버 SemVer 핀 강제 (`@latest` 금지, `RULES.md` 명시).
- `package.json` 의존성 최소화, audit 정기 실행.

### 4. Secret leakage
- `.gitignore` 에 시크릿 패턴 명시 (`.env*`, `*.pem`, `*.key`, `credentials*`).
- audit log 에 secret 자동 감지 / 플레이스홀더 치환 (Day 8 이후).
- 핸드오프 마크다운 5필드는 산문 금지 — 토큰 / 시크릿 노출 표면 축소.

### 5. Persistent memory
- `.harness/state/sessions/<id>/` 는 세션 격리.
- `~/.harness/instincts/` 는 사용자 명시 prune 또는 자동 prune (`olderDays`).
- 영속 메모리는 좁고 처분 가능 — 12-item Minimum Bar 룰 (AGENTS.md).

## 보안 점검 명령

```bash
npm run lint                              # catalog + 4 validator
node scripts/ci/check-markers.js          # 마커 일관성
node scripts/repair.js --check            # sha256 변조 검출
npm audit                                 # 의존성 취약점 (외부 도구)
npm test -- tests/unit/severity.test.js   # severity 분류 회귀
```

## 12-item Minimum Security Bar

`docs/ARCHITECTURE.md §10` 의 12-item Bar 와 1:1 매핑. 현재 상태:

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | 시크릿 redaction | ✓ | `agent.yaml` `secret_redaction: true`. audit jsonl 작성 직전 마스킹. |
| 2 | 시크릿 파일 보호 | ✓ | `config-protection` hook 이 `.env`/`*.pem`/`credentials*` Edit 차단. |
| 3 | MCP allowlist + SemVer 핀 | ✓ | `mcp_pin_required: true`, `@latest` 금지. |
| 4 | 외향 네트워크 기본 차단 | ✓ | `outbound_network_default: deny`. opt-in 만. |
| 5 | sandbox 프로파일 | ✓ | agent frontmatter `sandbox: read-only/workspace-write/danger`. |
| 6 | 사실 조사 강제 | ✓ | `fact_forcing_default: true`, `gateguard-fact-force` hook. |
| 7 | audit log | ✓ | `.harness/audit/<date>.jsonl` 모든 도구 호출. |
| 8 | severity matrix + human gate | ✓ | round 3 / critical / blast 20 파일 트리거. |
| 9 | 승인 필요 작업 | ✓ | `unsandboxed_shell, egress, deploy, off_repo_write`. |
| 10 | OIDC / 키리스 인증 | **미구현 — §"채택 절차" 참조** | GitHub Actions 시크릿 → OIDC token 전환. |
| 11 | dead-man switch | **미구현 — §"채택 절차" 참조** | 일정 시간 응답 없으면 토큰 자동 만료. |
| 12 | 의존성 / supply chain 스캔 | **부분** | npm audit 가이드만. CI 자동화 미통합. |

## 미구현 항목 채택 절차 (10 / 11 / 12)

### #10 OIDC / 키리스 인증

**의도**: GitHub Actions 가 `ANTHROPIC_API_KEY` 같은 장기 시크릿 대신 OIDC token 으로 임시 인증을 받도록 한다. 시크릿 누출 시 영향 시간 단축.

**채택 단계**:
1. Anthropic / OpenAI 가 OIDC federated identity 를 지원하는지 확인 (현재는 미지원 — 보류).
2. 사내 LLM endpoint 가 OIDC 지원 시 `runners/internal.js` 의 인증 헤더를 OIDC token 으로 전환.
3. `agent.yaml.security` 에 `auth_mode: oidc | static_token` 항목 추가.
4. GitHub Actions 의 `permissions.id-token: write` 설정 + `aud` claim 검증.

**수용 가능 임시 대안**: Actions 시크릿을 organization-level + environment-protected 로 두고 90일 rotation 정책.

### #11 Dead-man switch

**의도**: ralph 모드 등 영속 데몬이 비정상 정지하거나 외부 통신 두절 시 자동으로 작업 토큰을 무효화. "장기 미응답 = 위협 가능성" 가정.

**채택 단계**:
1. `~/.harness/heartbeat` 파일에 매 사이클 timestamp 갱신 (ralph / wait 가).
2. `scripts/daemon/wait.js` 에 `--dead-man-timeout-min` 옵션 추가 (기본: 30분).
3. 타임아웃 초과 시:
   - 진행 중인 모든 wakeup.json 파일 삭제.
   - `ANTHROPIC_API_KEY` 같은 환경 변수를 자식 프로세스에서 제거 (덮어쓰기 방어).
   - HUMAN_GATE 자동 생성 + audit jsonl 에 기록.
4. 사용자가 `harness wait --resume` 으로 명시 재시작.

**수용 가능 임시 대안**: `HARNESS_RALPH_MAX_ITER` 강제 + `HARNESS_DAILY_COST_CAP_USD` 비용 차단.

### #12 Supply chain 자동 스캔

**의도**: npm / pip / cargo 의존성의 알려진 CVE 와 typosquatting 을 PR 단계에서 자동 차단.

**채택 단계 (npm)**:
1. `.github/workflows/harness-validate.yml` 에 step 추가:
   ```yaml
   - run: npm audit --audit-level=high --omit=dev
   - run: npx --yes audit-ci --high
   ```
2. `package-lock.json` 이 PR 에서 변경되면 reviewer 알림 (label `dep-update`).
3. 새 의존성 추가 시 PR 본문에 weekly downloads / last publish / 메인테이너 명시 강제 (PR 템플릿).
4. `dependabot.yml` 또는 `renovate.json` 으로 자동 PR 생성 + minor 자동 머지.

**채택 단계 (Rust)**:
1. `cargo-deny` 또는 `cargo-audit` CI 통합.
2. `runtime/Cargo.lock` 커밋 강제.

**수용 가능 임시 대안**: 분기 1회 `npm audit` + 새 의존성 추가 시 수동 검토.

## 알려진 미검증

`docs/AUDIT.md` 의 §3.3 참조. 외부 의존이 큰 항목들 (API 키 / Codex CLI / Gemini CLI / Rust 컴파일 / GitHub push) 은 사용자 동의 시점에 즉시 검증 가능.

## 보안 룰 위반 보고

보안 정책 위반을 발견했다면 (예: 시크릿 하드코딩 PR, 의심스러운 의존성 추가):

1. Issue 또는 PR 코멘트로 즉시 알림
2. 머지된 코드면 `git revert` 후 root cause 분석
3. 룰 자체를 강화 (RULES.md / SECURITY.md 갱신)
4. severity ≥ HIGH 면 `security-reviewer` 에이전트로 영향 범위 분석
