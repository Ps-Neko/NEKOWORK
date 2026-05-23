/**
 * Fixture schemas — D8 lock의 visualizer 자체 분기.
 *
 * 본래 plan D8 명시는 forge-engine 의 createValidator() 직접 호출이지만,
 * forge-engine package.json 에 `exports` 가 없어 cross-package import 가
 * 까다롭다. 1차 분기 결정 (Phase 1.0): decision schema 의 핵심 필드만
 * visualizer 안에 inline 정의 + forge-engine 과의 drift 감지는 별도 TODO
 * (VIZ-SCHEMA-DRIFT) 로 후속.
 *
 * 후속 (TODOS.md 등록): T16 의 Phase 1.0 ship 직후 작업.
 *   1. forge-engine 의 package.json 에 exports 추가
 *   2. visualizer 가 forge-engine 의 decisionSchema 직접 사용
 *   3. visualizer 자체 schema 삭제 (drift 자동 제거)
 */

export const decisionFixtureSchema = {
  $id: 'visualizer-fixture-decision',
  type: 'object',
  required: [
    'schemaVersion',
    'project',
    'taskId',
    'workflowStage',
    'verdict',
    'riskLevel',
    'humanApprovalRequired',
    'humanApproved',
    'evidence',
    'apply'
  ],
  properties: {
    schemaVersion: { type: 'string', const: '0.5' },
    project: { type: 'string', minLength: 1 },
    taskId: { type: 'string', minLength: 1 },
    workflowStage: { type: 'string' },
    verdict: {
      type: 'string',
      enum: ['PASS', 'PASS_WITH_WARNINGS', 'NEEDS_HUMAN_REVIEW', 'BLOCK', 'INSUFFICIENT_EVIDENCE']
    },
    riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    humanApprovalRequired: { type: 'boolean' },
    humanApproved: { type: 'boolean' },
    evidence: {
      type: 'object',
      additionalProperties: { type: 'string' }
    },
    apply: {
      type: 'object',
      required: ['allowed'],
      properties: {
        allowed: { type: 'boolean' },
        reason: { type: 'string' }
      }
    }
  }
} as const;

export const samplePrFixtureSchema = {
  $id: 'visualizer-fixture-sample-pr',
  type: 'object',
  required: [
    'id',
    'title',
    'description',
    'audience',
    'purpose',
    'language',
    'pr_id',
    'base_branch',
    'head_branch',
    'files_changed',
    'stats',
    'diff_hash',
    'diff_content'
  ],
  properties: {
    id: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    audience: { type: 'string' },
    purpose: { type: 'string' },
    language: { type: 'string', enum: ['ko', 'en'] },
    pr_id: { type: 'string', minLength: 1 },
    base_branch: { type: 'string', minLength: 1 },
    head_branch: { type: 'string', minLength: 1 },
    files_changed: { type: 'array', items: { type: 'string' } },
    stats: {
      type: 'object',
      required: ['additions', 'deletions', 'files'],
      properties: {
        additions: { type: 'integer', minimum: 0 },
        deletions: { type: 'integer', minimum: 0 },
        files: { type: 'integer', minimum: 0 }
      }
    },
    diff_hash: { type: 'string' },
    diff_content: { type: 'string' }
  }
} as const;

export const claudeReviewFixtureSchema = {
  $id: 'visualizer-fixture-claude-review',
  type: 'object',
  required: ['source', 'verdict', 'comments'],
  properties: {
    source: { type: 'string', enum: ['manufactured', 'recorded'] },
    verdict: { type: 'string', enum: ['LGTM', 'REQUEST_CHANGES'] },
    comments: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'line', 'body'],
        properties: {
          file: { type: 'string' },
          line: { type: 'integer', minimum: 0 },
          body: { type: 'string' }
        }
      }
    },
    attribution: { type: 'string' }
  },
  allOf: [
    {
      if: { properties: { source: { const: 'recorded' } }, required: ['source'] },
      then: { required: ['attribution'] }
    }
  ]
} as const;

export const preverifySummaryFixtureSchema = {
  $id: 'visualizer-fixture-preverify-summary',
  type: 'object',
  required: ['schemaVersion', 'project', 'taskId', 'generatedAt', 'checks', 'summary'],
  properties: {
    schemaVersion: { type: 'string', const: 'preverify-v0' },
    project: { type: 'string', minLength: 1 },
    taskId: { type: 'string', minLength: 1 },
    generatedAt: { type: 'string', format: 'date-time' },
    checks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'status', 'message'],
        properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['pass', 'warn', 'fail', 'pending'] },
          message: { type: 'string' }
        }
      }
    },
    summary: {
      type: 'object',
      additionalProperties: { type: 'integer', minimum: 0 }
    }
  }
} as const;

export const verifySummaryFixtureSchema = {
  $id: 'visualizer-fixture-verify-summary',
  type: 'object',
  required: ['schemaVersion', 'project', 'taskId', 'generatedAt', 'acceptance_coverage', 'gates', 'summary'],
  properties: {
    schemaVersion: { type: 'string', const: 'verify-v0' },
    project: { type: 'string', minLength: 1 },
    taskId: { type: 'string', minLength: 1 },
    generatedAt: { type: 'string', format: 'date-time' },
    acceptance_coverage: {
      type: 'object',
      required: ['required', 'met', 'missing'],
      properties: {
        required: { type: 'array', items: { type: 'string' } },
        met: { type: 'array', items: { type: 'string' } },
        missing: { type: 'array', items: { type: 'string' } }
      }
    },
    gates: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'status', 'summary'],
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['passed', 'warnings', 'failed', 'pending'] },
          summary: { type: 'string' }
        }
      }
    },
    summary: {
      type: 'object',
      required: ['verdict', 'riskLevel', 'applyAllowed'],
      properties: {
        verdict: { type: 'string' },
        riskLevel: { type: 'string' },
        applyAllowed: { type: 'boolean' }
      }
    }
  }
} as const;

export interface FixtureSchemaMap {
  readonly samplePr: typeof samplePrFixtureSchema;
  readonly decision: typeof decisionFixtureSchema;
  readonly claudeReview: typeof claudeReviewFixtureSchema;
  readonly preverifySummary: typeof preverifySummaryFixtureSchema;
  readonly verifySummary: typeof verifySummaryFixtureSchema;
}

export const fixtureSchemas: FixtureSchemaMap = {
  samplePr: samplePrFixtureSchema,
  decision: decisionFixtureSchema,
  claudeReview: claudeReviewFixtureSchema,
  preverifySummary: preverifySummaryFixtureSchema,
  verifySummary: verifySummaryFixtureSchema
};
