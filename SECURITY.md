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
node scripts/ci/catalog.js          # 카탈로그 무결성
node scripts/ci/check-markers.js    # 마커 일관성
npm audit                           # 의존성 취약점 (외부 도구)
node --test tests/unit/severity.test.js   # severity 분류 회귀
```

## 알려진 미구현

`docs/AUDIT.md` 의 §3.3 / §6 참조. 검증 안 된 컴포넌트 / 마찰 / 다음 세션 우선순위.

## 보안 룰 위반 보고

보안 정책 위반을 발견했다면 (예: 시크릿 하드코딩 PR, 의심스러운 의존성 추가):

1. Issue 또는 PR 코멘트로 즉시 알림
2. 머지된 코드면 `git revert` 후 root cause 분석
3. 룰 자체를 강화 (RULES.md / SECURITY.md 갱신)
