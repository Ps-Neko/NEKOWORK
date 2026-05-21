import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = path.join(root, '.github', 'workflows', 'hardened-validate.yml');

if (!fs.existsSync(workflowPath)) {
  throw new Error('missing hardened workflow');
}

const raw = fs.readFileSync(workflowPath, 'utf8');
const workflow = YAML.parse(raw);

assert(!raw.includes('pull_request_target'), 'workflow must not use pull_request_target');
assert(!raw.includes('npm publish'), 'workflow must not publish packages');
assert(!raw.includes('aws-actions/configure-aws-credentials'), 'workflow must not configure cloud credentials');
assert(!raw.includes('${{ secrets.'), 'workflow must not read static secrets');

assert(workflow.permissions?.contents === 'read', 'top-level contents permission must be read');
assert(workflow.concurrency?.['cancel-in-progress'] === true, 'workflow must cancel superseded runs');

const jobs = workflow.jobs || {};
assert(Object.keys(jobs).length > 0, 'workflow must define jobs');

for (const [jobName, job] of Object.entries(jobs)) {
  assert(job['timeout-minutes'] && job['timeout-minutes'] <= 20, `${jobName} must have a bounded timeout`);
  assert(job.permissions?.contents === 'read', `${jobName} contents permission must be read`);
  assert(job.permissions?.actions === 'read', `${jobName} actions permission must be read`);

  for (const step of job.steps || []) {
    if (!step.uses) continue;
    assert(/@[a-zA-Z0-9._-]+$/.test(step.uses), `${step.uses} must pin an action ref`);
    assert(!/@main$|@master$|@latest$/i.test(step.uses), `${step.uses} must not use floating refs`);
  }
}

console.log('github-actions-hardening checks passed');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
