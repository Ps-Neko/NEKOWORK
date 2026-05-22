/**
 * Evidence contract — verdict 산출의 입력 원자.
 *
 * RuleFinding: deterministic rule이 발견한 단일 사실.
 * ReviewSnapshot: 외부 review adapter(예: Codex)의 요약.
 *
 * 본 모듈은 인터페이스만 정의한다. 구현(rule 실행기, review adapter)은
 * @ps-neko/forge-engine 에서 산다.
 */

export type Severity = "info" | "warning" | "high" | "critical";

export interface RuleFinding {
  ruleId: string;
  severity: Severity;
  file?: string;
  line?: number;
  message: string;
}

export interface ReviewSnapshot {
  status: "passed" | "warnings" | "failed" | "not_run";
  adapterCount: number;
  criticalFindings: number;
}
