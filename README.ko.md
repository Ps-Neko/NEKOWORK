# NEKOWORK

[English](README.md) | [한국어](README.ko.md)

**AI는 10초 만에 100줄을 씁니다. 그게 `main`에 들어가기 전, 누가 검사하나요?**

NEKOWORK는 AI가 작성한 코드를 위한 로컬 안전 게이트입니다. AI 도구가 만든 모든
변경을 검토하고, 위험한 부분을 짚어내고, 최종 결정은 **당신**이 내리게 합니다 —
스스로 커밋하거나 push하거나 배포하지 않습니다.

[![CI](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)
[![npm](https://img.shields.io/npm/v/@ps-neko/nekowork/alpha?color=cb3837&logo=npm)](https://www.npmjs.com/package/@ps-neko/nekowork)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![status: public alpha](https://img.shields.io/badge/status-public%20alpha-orange)](#상태--공개-알파)

<p align="center">
  <a href="https://ps-neko.github.io/NEKOWORK/?fixture=sample-pr-001">
    <img src="packages/nekowork-cli/docs/assets/hero.gif" alt="NEKOWORK가 위험한 AI 작성 diff를 차단하는 장면" width="800" />
  </a>
  <br/>
  <em>Claude said LGTM. NEKOWORK blocked.</em> &nbsp;·&nbsp;
  <a href="https://ps-neko.github.io/NEKOWORK/?fixture=sample-pr-001"><strong>라이브 데모 →</strong></a>
</p>

**누구를 위한 도구인가:** Claude Code, Cursor, Codex에게 코드를 맡기면서도,
속도는 얻되 위험한 변경을 그대로 병합하긴 싫은 개발자와 팀.

## 빠른 시작

요구사항: Node.js 22+, npm, 그리고 커밋이 하나 이상 있는 git 저장소.

```bash
# AI 도구가 파일을 바꾼 직후:
npx -y @ps-neko/nekowork@alpha check        # 30초 환경 점검
npx -y @ps-neko/nekowork@alpha verify-pr    # diff 스캔 → 판정
```

NEKOWORK가 diff를 읽고, 사람이 읽을 수 있는 `REPORT.md`를 쓰고, 이 변경을
병합해도 안전한지 알려줍니다. 이게 전부입니다.

## 무엇이 보이나

AI가 diff에 위험을 남기면:

```text
=== verify-pr ===
  verdict        : BLOCK
  reason         : Hardcoded secret fallback detected (src/auth.ts:42)
  risk_level     : CRITICAL
  merge_allowed  : false
  apply_allowed  : false
```

깨끗한 변경은 통과합니다. 위험한 변경은 이유와 정확한 줄 번호와 함께 차단됩니다.

## 어떻게 작동하나 (쉬운 버전)

1. **AI 도구가 코드를 씁니다.** NEKOWORK가 코드를 대신 써주지 않습니다.
2. **NEKOWORK가 고정된 위험 규칙을 diff에 적용합니다** — 같은 diff면 언제나 같은
   판정. 어떤 LLM도 결과에 "투표"하지 못합니다.
3. **증거를 저장합니다** — 실제로 읽을 수 있는 리포트로.
4. **당신이 Human Gate(사람 승인 단계)에서 결정합니다** — 승인하거나, 하지 않거나.
5. **그 다음에야 적용됩니다.** 자동 커밋 없음. 자동 push 없음. 갑작스러운 배포 없음.

## 무엇을 잡아주나

AI 도구가 슬쩍 끼워 넣곤 하는 것들을 위한 결정적(deterministic) 규칙 — 하드코딩된
시크릿, 위험한 `process.env.X || "fallback"` 패턴, 위험한 인증/배포 수정 등.
전체 규칙 카탈로그와 1.0 범위: [docs/SCOPE-1.0.md](docs/SCOPE-1.0.md).

## NEKOWORK가 아닌 것

- IDE도, 또 하나의 에이전트 묶음도 아닙니다.
- 코드를 스스로 push하는 오토파일럿이 아닙니다.
- Cursor·Claude Code·Codex의 경쟁자가 아닙니다 — 그들의 출력을 NEKOWORK로 **흘려보내세요**.
- 테스트·계약 검증 도구(Hurl, `go test`)가 아닙니다 — 그건 동작이 올바른지 보고, NEKOWORK는 머지 전 diff 자체가 위험한지 봅니다.

## 상태 — 공개 알파

초기 알파이고, 솔직히 피드백을 찾는 중입니다. 오늘 실제로 되는 것: npm 배포,
CI green, [라이브 데모](https://ps-neko.github.io/NEKOWORK/?fixture=sample-pr-001),
그리고 전체 테스트 스위트. 정직한 단서 하나: **"verified(검증됨)"는 증거가 기록된
독립 검토를 뜻하지, 수학적으로 옳다고 증명됐다는 뜻이 아닙니다.** 빈틈이나 잘못된
차단을 발견하셨다면?
[알파 피드백 남기기 →](https://github.com/Ps-Neko/NEKOWORK/issues/new?template=alpha-feedback.yml)

## 문서 · 기여 · 라이선스

- **여기서 시작:** [Quickstart](docs/QUICKSTART.md) · [검증 작동 방식](docs/SCOPE-1.0.md) · [통합](docs/INTEGRATION.md)
- **더 깊이:** [아키텍처](docs/ARCHITECTURE.md) · [고급 명령](docs/ADVANCED.md) · [비전](docs/VISION.md)
- **기여:** [CONTRIBUTING.md](CONTRIBUTING.md) — 영어 PR 환영.
- **라이선스:** MIT
