/**
 * Fixture schemas — D8 lock 의 visualizer 분기 (VIZ-SCHEMA-DRIFT partial 진행 후).
 *
 * decision schema 의 정본 = `forge-engine` (workspace package `nekoforge`) 의
 * `src/schemas/decision.schema.ts`. visualizer 는 `nekoforge/schemas/decision`
 * 의 `decisionSchema` 를 직접 import 해 drift 0 을 보장한다. forge-engine 의
 * `package.json` 의 `exports` 가 본 import 를 노출 (VIZ-SCHEMA-DRIFT 의
 * Phase 1.0 ship 직후 작업).
 *
 * 나머지 4 schema (samplePr / claudeReview / preverify / verify) 는 visualizer
 * 자체 inline 정의로 유지 — forge-engine 의 등록 schema 13종에 포함되지 않은
 * 산출물이라 visualizer 가 own 한다. 향후 forge-engine 으로 흡수 시
 * VIZ-SCHEMA-DRIFT 의 Stage 2 작업.
 */

import { decisionSchema as forgeDecisionSchema } from 'nekoforge/schemas/decision';

export const decisionFixtureSchema = forgeDecisionSchema;

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
