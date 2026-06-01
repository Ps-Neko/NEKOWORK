# Security Policy

## Reporting a Vulnerability

보안 취약점은 **공개 issue 로 보고하지 마세요**. 대신:

1. 레포 owner 에게 GitHub Private Security Advisory 로 직접 보고.
2. 또는 "Private vulnerability reporting" 채널 사용.

응답 SLA: 보고 후 48시간 내 acknowledge, 영향 평가 후 수정 일정 공유.

## 위협 모델

NEKOWORK 는 local-first 검증 게이트입니다. **LLM 호출 0, 외향 네트워크 0, 자동 실행 0.** 다음 영역에 집중합니다.

### 1. Rule false negative (위험 패턴 누락)

위험 패턴을 못 잡으면 잘못된 안전감을 만듭니다. 각 rule 의 `tests/fixtures/<rule>/manifest.json` positive 시드로 recall ≥ 0.90 강제. CI 단위 테스트로 회귀 차단.

### 2. Rule false positive (잘못된 차단)

CRITICAL FP 가 잦으면 사용자가 게이트 자체를 무시하게 됩니다. 각 fixture manifest 의 negative 시드로 CRITICAL FP rate ≤ 0.10 강제.

### 3. Diff parsing 안전

`scripts/lib/diff-parser.js` 는 외부 git 출력을 받습니다. 잘못된 입력에 대해 fail-fast, 임의 파일 경로를 신뢰하지 않습니다.

### 4. 사용자 자료 노출

`verify-pr` 가 만드는 `.nekowork/decision.json` 과 `REPORT.md` 는 working-tree diff 의 일부를 그대로 포함합니다. CI 에서 PR comment 로 출력할 때 시크릿이 함께 노출될 수 있습니다 — `--comment-file` 사용 시 그 파일이 어디로 가는지 직접 검토하세요.

### 5. 의존성 / 공급망

slim 패키지의 `dependencies` 는 비어 있습니다 (Node 내장만 사용). `devDependencies` 변경 시 PR 본문에 weekly downloads / last publish / 메인테이너를 명시.

## 보안 점검 명령

```bash
cd packages/nekowork
node --test tests/unit/*.test.js   # 모든 rule + decision + risk-classifier 회귀
node scripts/cli.js verify-pr      # 자기 자신의 working-tree 에 게이트 적용
npm audit                          # 의존성 취약점 — 현재 dependencies={}
```

## 보안 룰 위반 보고

NEKOWORK 자체의 보안 정책 위반 (rule 에서 시크릿 패턴 leak, hardcoded 테스트 토큰, scanner 가 가짜 시크릿을 진짜로 분류 등) 발견 시:

1. Issue 또는 PR 코멘트로 즉시 알림.
2. 머지된 코드면 `git revert` 후 root cause 분석.
3. 룰 자체를 강화 — 시드 추가 + 단위 테스트 추가.
