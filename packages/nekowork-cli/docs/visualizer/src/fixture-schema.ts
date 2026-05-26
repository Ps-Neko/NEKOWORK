/**
 * Fixture schemas — visualizer 가 PR 산출물을 검증하는 JSON schema 모음.
 *
 * decision schema: 정본은 헤비 엔진(standalone `Ps-Neko/NEKOFORGE`)의
 * `src/schemas/decision.schema.ts`. monorepo 에서 헤비 엔진을 분리하면서
 * (engine single-source 마이그레이션) visualizer 가 **자체 복사본**을 보유한다.
 * NEKOFORGE 의 decision schema 가 바뀌면 본 파일도 수동 동기화한다
 * (decision schema 는 안정적이라 변경 빈도가 낮음).
 *
 * 나머지 4 schema (samplePr / claudeReview / preverify / verify) 도 visualizer
 * 자체 정의 — 헤비 엔진 등록 schema 에 없는 visualizer 고유 산출물.
 */

// decision.json schema — NEKOFORGE src/schemas/decision.schema.ts 의 로컬 복사본 (drift 시 수동 동기화).
export const decisionFixtureSchema = {
  $id: 'decision',
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
      enum: [
        'PASS',
        'PASS_WITH_WARNINGS',
        'NEEDS_HUMAN_REVIEW',
        'BLOCK',
        'INSUFFICIENT_EVIDENCE'
      ]
    },
    riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    humanApprovalRequired: { type: 'boolean' },
    humanApproved: { type: 'boolean' },
    teamArchitecture: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        agents: { type: 'array' },
        orchestrator: { type: 'string' }
      }
    },
    qualityPolicy: {
      type: 'object',
      properties: {
        rules: { type: 'string' },
        hooks: { type: 'string' },
        contextPolicy: { type: 'string' },
        status: {
          type: 'string',
          enum: ['applied', 'missing', 'violated']
        },
        violations: { type: 'array' }
      }
    },
    tests: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['passed', 'failed', 'not_run', 'insufficient']
        },
        commands: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' }
      }
    },
    reviewAdapters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['adapterId', 'status'],
        properties: {
          adapterId: { type: 'string' },
          status: {
            type: 'string',
            enum: ['passed', 'warnings', 'failed', 'not_run']
          },
          findingsCount: { type: 'integer', minimum: 0 },
          criticalFindings: { type: 'integer', minimum: 0 },
          summary: { type: 'string' }
        }
      }
    },
    deterministicRules: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['passed', 'failed'] },
        triggeredRules: { type: 'array', items: { type: 'string' } }
      }
    },
    qualityContract: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        status: { type: 'string', enum: ['valid', 'missing', 'violated'] },
        failedBars: { type: 'array', items: { type: 'string' } }
      }
    },
    qualityScore: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        overall: { type: 'number', minimum: 0, maximum: 100 },
        minimumRequired: { type: 'number', minimum: 0, maximum: 100 },
        status: { type: 'string', enum: ['passed', 'warning', 'failed'] }
      }
    },
    factoryCells: {
      type: 'object',
      additionalProperties: {
        type: 'string',
        enum: ['complete', 'missing', 'partial']
      }
    },
    architectureReview: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['passed', 'warnings', 'failed', 'not_run']
        },
        findingsCount: { type: 'integer', minimum: 0 },
        criticalFindings: { type: 'integer', minimum: 0 }
      }
    },
    designReview: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['passed', 'warnings', 'failed', 'not_applicable', 'not_run']
        },
        findingsCount: { type: 'integer', minimum: 0 },
        criticalFindings: { type: 'integer', minimum: 0 }
      }
    },
    workerFactory: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['complete', 'partial', 'missing', 'violated']
        },
        profile: { type: 'string' },
        requiredWorkers: { type: 'array', items: { type: 'string' } },
        completedWorkers: { type: 'array', items: { type: 'string' } },
        missingWorkers: { type: 'array', items: { type: 'string' } },
        roleSeparationViolations: { type: 'array', items: { type: 'string' } },
        workerFindingsCount: { type: 'integer', minimum: 0 },
        criticalWorkerFindings: { type: 'integer', minimum: 0 }
      }
    },
    rulePacks: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['complete', 'missing', 'violated']
        },
        enabled: { type: 'array', items: { type: 'string' } },
        required: { type: 'array', items: { type: 'string' } },
        missingRequired: { type: 'array', items: { type: 'string' } },
        triggeredPacks: { type: 'array', items: { type: 'string' } }
      }
    },
    skillPacks: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['complete', 'missing', 'partial']
        },
        enabled: { type: 'array', items: { type: 'string' } },
        recommended: { type: 'array', items: { type: 'string' } },
        missingRecommended: { type: 'array', items: { type: 'string' } }
      }
    },
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
    },
    generatedAt: { type: 'string', format: 'date-time' }
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

export const fixtureSchemas = {
  samplePr: samplePrFixtureSchema,
  decision: decisionFixtureSchema,
  claudeReview: claudeReviewFixtureSchema,
  preverifySummary: preverifySummaryFixtureSchema,
  verifySummary: verifySummaryFixtureSchema
} as const;

export type FixtureSchemaMap = typeof fixtureSchemas;
