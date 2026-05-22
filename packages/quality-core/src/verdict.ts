/**
 * Verdict contract — gate 의사결정 schema.
 *
 * computeVerdict 구현은 @ps-neko/forge-engine 의 src/core/gate/verdict.ts 에 있다.
 * 본 모듈은 입력·출력 shape 만 정의한다.
 */

import type { RuleFinding } from "./evidence.js";

export type Verdict =
  | "PASS"
  | "PASS_WITH_WARNINGS"
  | "NEEDS_HUMAN_REVIEW"
  | "BLOCK"
  | "INSUFFICIENT_EVIDENCE";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface VerdictInputs {
  findings: readonly RuleFinding[];
  testStatus: "passed" | "failed" | "not_run" | "insufficient";
  reviewStatus: "passed" | "warnings" | "failed" | "not_run";
  evidenceMissing?: boolean;
  schemaFailed?: boolean;
}

export interface VerdictOutput {
  verdict: Verdict;
  riskLevel: RiskLevel;
  humanApprovalRequired: boolean;
  reasons: string[];
}
