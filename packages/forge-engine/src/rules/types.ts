/**
 * Deterministic rule 인터페이스 — ARCHITECTURE.md §6, SECURITY.md §3.
 *
 * rule 은 순수 함수. 외부 네트워크·hooks 에 의존하지 않는다.
 *
 * Severity / RuleFinding / ReviewSnapshot 의 type contract 는
 * @ps-neko/quality-core 가 정의한다. 본 모듈은 forge-engine 내부 rule 작성에
 * 필요한 추가 type (PolicyFlags, RuleContext, DeterministicRule, makeFinding)
 * 만 정의하고 contract type 은 re-export.
 */
import type { Diff } from "../utils/diff.js";
import type { Severity, RuleFinding, ReviewSnapshot } from "@ps-neko/quality-core";

export type { Severity, RuleFinding, ReviewSnapshot };

export interface PolicyFlags {
  testFirst?: boolean;
  securityFirst?: boolean;
  reviewFirst?: boolean;
}

export interface RuleContext {
  diff: Diff;
  policies?: PolicyFlags;
  review?: ReviewSnapshot;
  team?: {
    pattern?: string;
    agents?: Array<{ id: string; role: string; owns: string[] }>;
  };
  hooksCommandWhitelistViolations?: number;
  testStatus?: "passed" | "failed" | "not_run" | "insufficient";
  highRiskFlags?: {
    dangerousFileWrite?: boolean;
    authBypass?: boolean;
    secretFallback?: boolean;
    hookInjection?: boolean;
    agentPermissionExpansion?: boolean;
    testDeletion?: boolean;
  };
}

export interface DeterministicRule {
  id: string;
  describe: string;
  run(ctx: RuleContext): Promise<RuleFinding[]>;
}

export function makeFinding(
  ruleId: string,
  severity: Severity,
  message: string,
  extra: { file?: string; line?: number } = {}
): RuleFinding {
  return {
    ruleId,
    severity,
    message,
    ...(extra.file !== undefined ? { file: extra.file } : {}),
    ...(extra.line !== undefined ? { line: extra.line } : {})
  };
}
