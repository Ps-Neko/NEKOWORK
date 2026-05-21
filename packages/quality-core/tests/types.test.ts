/**
 * Type-level assertion tests — contract만 검증.
 *
 * 인터페이스가 의도된 shape를 유지하는지를 컴파일 타임에 강제한다.
 * 런타임 어설션 없음 (type-only 패키지). 본 파일이 tsc 통과하면 통과.
 */

import { test } from "node:test";
import type {
  Severity,
  RuleFinding,
  ReviewSnapshot,
  Verdict,
  RiskLevel,
  VerdictInputs,
  VerdictOutput
} from "../src/index.js";

type AssertEqual<T, U> = (<V>() => V extends T ? 1 : 2) extends <V>() => V extends U ? 1 : 2
  ? true
  : false;

type AssertTrue<T extends true> = T;

test("Severity is the expected union", () => {
  type _ = AssertTrue<AssertEqual<Severity, "info" | "warning" | "high" | "critical">>;
});

test("RuleFinding requires ruleId, severity, message; file/line optional", () => {
  const sample: RuleFinding = {
    ruleId: "test-rule",
    severity: "warning",
    message: "ok"
  };
  const withLoc: RuleFinding = {
    ruleId: "test-rule",
    severity: "critical",
    message: "ok",
    file: "src/x.ts",
    line: 12
  };
  void sample;
  void withLoc;
});

test("ReviewSnapshot status enum is fixed", () => {
  type _ = AssertTrue<
    AssertEqual<ReviewSnapshot["status"], "passed" | "warnings" | "failed" | "not_run">
  >;
});

test("Verdict union has 5 members", () => {
  type _ = AssertTrue<
    AssertEqual<
      Verdict,
      "PASS" | "PASS_WITH_WARNINGS" | "NEEDS_HUMAN_REVIEW" | "BLOCK" | "INSUFFICIENT_EVIDENCE"
    >
  >;
});

test("RiskLevel union has 4 members", () => {
  type _ = AssertTrue<AssertEqual<RiskLevel, "low" | "medium" | "high" | "critical">>;
});

test("VerdictInputs findings is readonly array of RuleFinding", () => {
  const findings: readonly RuleFinding[] = [];
  const input: VerdictInputs = {
    findings,
    testStatus: "passed",
    reviewStatus: "passed"
  };
  void input;
});

test("VerdictOutput shape lock-in", () => {
  const output: VerdictOutput = {
    verdict: "PASS",
    riskLevel: "low",
    humanApprovalRequired: false,
    reasons: ["ok"]
  };
  void output;
});
