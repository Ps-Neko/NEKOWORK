# Secret Fallback Fixture Corpus

NEKOWORK 1.0 의 killer rule (Secret Fallback) 의 recall / false positive 측정용 fixture 코퍼스.

## 구조

```text
positive/                  AI 가 만든 위험한 fallback 패턴 (BLOCK 되어야 함)
negative/                  비슷하지만 정상 (false positive 아니어야 함)
manifest.json              entry 메타데이터 + expected findings
```

## 현재 상태

| Category | Count | Source |
|---|---|---|
| Positive (synthetic seed) | 10 | hand-crafted, 2026-05-16 |
| Negative (synthetic seed) | 10 | hand-crafted, 2026-05-16 |

1차 synthetic seed 입니다. 실제 1.0 recall/FP 측정은 다음이 추가된 뒤에 의미가 있습니다:

- **OSS curation (negative 우선)** (`source: "github:owner/repo@sha"`)
  Popular Node OSS (Next.js, Express, Prisma, AWS SDK 등) 의 실제 `process.env`
  사용 패턴을 negative corpus 로 추가. 이게 FP 위험의 진짜 측정 근거.
- **Live AI 생성 (positive 의 주된 출처)** (`source: "ai-generated:claude-code-..."`)
  Cursor / Claude Code / Codex 에게 실제 task ("OpenAI client with env config" 등)
  시키고 생성된 diff 에서 fallback 패턴 추출. 1.0 의 진짜 신호.

목표 비율 (per [SCOPE-1.0.md §9](../../../docs/SCOPE-1.0.md#9-fixture-출처-정책)):
- 전체 corpus 30+ positive / 50+ negative
- synthetic 비율 ≤ 30%

### OSS positive curation 이 어려운 이유

Mature popular OSS 는 hardcoded secret fallback 을 commit 하지 않습니다 (=다행).
GitHub code search 로 `process.env.X || "sk-..."` 를 검색해도 의미 있는 결과는
주로 toy/abandoned 레포에 있습니다. 따라서 positive corpus 의 주된 신호 출처는
**stage 3 (live AI 생성)** 입니다. OSS scrape 는 negative 보강에 더 효과적입니다.

### Stage 2 / Stage 3 수집 절차 (followup)

1. **Stage 2 — OSS negative 보강 (목표 20+ negative)**:
   - 후보 레포: Next.js, Express, Prisma, AWS SDK, Stripe SDK, dotenv,
     Vercel examples, NestJS, Fastify 등
   - GitHub raw URL 로 file 내용 fetch
   - `manifest.json` 에 `source: "github:owner/repo@sha:path/to/file#L42-L60"` 기록
   - 우리 rule 이 FP 내는지 확인 → FP 면 rule 튜닝 신호

2. **Stage 3 — Live AI positive (목표 20+ positive)**:
   - prompt 예시: "add OpenAI client that reads OPENAI_API_KEY from env",
     "implement Stripe webhook handler with secret from env",
     "GitHub OAuth token loading"
   - 생성된 diff 에서 fallback 패턴 추출
   - `manifest.json` 에 `source: "ai-generated:claude-code-2026-MM-DD"`
     + 원본 prompt 와 함께 기록

## 측정 게이트 (1.0 release 전)

```text
secret_fallback_recall    >= 0.90
secret_fallback_fp_rate   <= 0.10
critical_fp_rate          <= 0.10
```

## Entry 추가 절차

1. 코드 파일을 `positive/<NNN>-<short-name>.ts` 또는 `negative/...` 에 배치
2. `manifest.json` 의 `entries[]` 에 새 항목 추가
3. `expected_findings` 채우기 (positive 면 `{ rule, line, severity }`, negative 면 `[]`)
4. `source` 명시 (synthetic / github URL / ai-generated 메타)
5. 향후 벤치마크 러너가 manifest 를 읽어 recall/FP 자동 측정

## 비고

- positive 010 의 line 위치는 literal 이 있는 줄 (multi-line OR 체인의 마지막) 입니다.
- positive 004 와 006 은 flow-based 또는 구조적 fallback 이라 단순 regex 로는 잡기 어렵습니다 — stretch goal.
- negative 007 (테스트 파일) 과 010 (주석 only) 은 흔한 false positive 시나리오.
