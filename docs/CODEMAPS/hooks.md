# CODEMAP — hooks

> 자동 생성. `scripts/build-codemaps.js` 가 `hooks/` 를 스캔. 직접 편집 금지.
> 코드 본문은 포함 안 함. 네비게이션 보조용.

## 디렉터리 트리

```
hooks/
├── scripts/
│   ├── config-protection.js
│   ├── gateguard-fact-force.js
│   ├── persistent-mode.mjs
│   ├── pre-bash-dispatcher.js
│   └── quality-gate.js
└── hooks.json
```

## 핵심 export

| 파일 | export | 설명 |
|---|---|---|
| `scripts/config-protection.js` | _(none)_ | PreToolUse(Edit\|Write) config-protection. .env / *.pem / *.key / credentials 등 시크릿 파일 직접 편집 차단. |
| `scripts/gateguard-fact-force.js` | _(none)_ | PreToolUse(Edit\|Write) gateguard-fact-force. "Are you sure?" 자기평가는 무력. importer / public API / schema 사실을 강제로 디스크에 남긴다. |
| `scripts/persistent-mode.mjs` | _(none)_ | Stop persistent-mode. .harness/state/sessions/<id>/active 가 있으면 wakeup.json drop. Day 3 stub. 실 데몬 (harness wait --start |
| `scripts/pre-bash-dispatcher.js` | _(none)_ | PreToolUse(Bash) 디스패처. ECC pre-bash-dispatcher.js 패턴. 단일 진입점 → 매처 분기 → 모듈. ENV 토글로 개별 on/off. stdin JSON 으로 Claude Code  |
| `scripts/quality-gate.js` | _(none)_ | PostToolUse(Edit\|Write) quality-gate. 변경 파일의 확장자에 따라 빠른 검증:   - .ts/.tsx: tsc --noEmit (해당 파일 + transitive). 가능하면 isola |

