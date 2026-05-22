/**
 * verdict 산출 알고리즘 — WORKFLOW.md §3.12.
 *
 * 입력 : finding 배열 + 테스트 상태 + review 상태.
 * 출력 : verdict + riskLevel + humanApprovalRequired + 사유 목록.
 *
 * Type contract는 @ps-neko/quality-core 가 정의한다. 본 모듈은 구현만 보유.
 * relative import 호환을 위해 동일 type 을 re-export.
 */
import type {
  RuleFinding,
  Verdict,
  RiskLevel,
  VerdictInputs,
  VerdictOutput
} from "@ps-neko/quality-core";

export type { Verdict, RiskLevel, VerdictInputs, VerdictOutput };

export function computeVerdict(input: VerdictInputs): VerdictOutput {
  const reasons: string[] = [];

  if (input.evidenceMissing || input.schemaFailed) {
    reasons.push(input.evidenceMissing ? "required evidence missing" : "schema validation failed");
    return {
      verdict: "INSUFFICIENT_EVIDENCE",
      riskLevel: "critical",
      humanApprovalRequired: true,
      reasons
    };
  }

  const critical = input.findings.filter((f) => f.severity === "critical");
  const high = input.findings.filter((f) => f.severity === "high");
  const warning = input.findings.filter((f) => f.severity === "warning");

  if (critical.some((f) => f.ruleId === "codex-missing-risk")) {
    reasons.push(...critical.map((f) => `[${f.ruleId}] ${f.message}`));
    return {
      verdict: "INSUFFICIENT_EVIDENCE",
      riskLevel: "critical",
      humanApprovalRequired: true,
      reasons
    };
  }

  if (critical.length > 0) {
    reasons.push(...critical.map((f) => `[${f.ruleId}] ${f.message}`));
    return {
      verdict: "BLOCK",
      riskLevel: "critical",
      humanApprovalRequired: true,
      reasons
    };
  }

  if (input.testStatus === "failed") {
    reasons.push("tests failed");
    return {
      verdict: "NEEDS_HUMAN_REVIEW",
      riskLevel: "high",
      humanApprovalRequired: true,
      reasons
    };
  }

  if (high.length > 0) {
    reasons.push(...high.map((f) => `[${f.ruleId}] ${f.message}`));
    return {
      verdict: "NEEDS_HUMAN_REVIEW",
      riskLevel: "high",
      humanApprovalRequired: true,
      reasons
    };
  }

  if (warning.length > 0 || input.reviewStatus === "warnings") {
    reasons.push(...warning.map((f) => `[${f.ruleId}] ${f.message}`));
    if (input.reviewStatus === "warnings") {
      reasons.push("review adapter returned warnings");
    }
    return {
      verdict: "PASS_WITH_WARNINGS",
      riskLevel: "medium",
      humanApprovalRequired: false,
      reasons
    };
  }

  return {
    verdict: "PASS",
    riskLevel: "low",
    humanApprovalRequired: false,
    reasons: ["no triggered rules; tests passed; review ok"]
  };
}
