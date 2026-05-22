#!/usr/bin/env node
// Security hardening CI gate: workflow permissions/timeouts/action pins, MCP pins,
// package spec hygiene, package-lock presence, and OIDC cloud-secret checks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const PACKAGE_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

const FORBIDDEN_VERSION_PREFIXES = [
  'file:',
  'git:',
  'git+',
  'http:',
  'https:',
  'link:',
  'workspace:',
];

export function isPinnedActionRef(uses) {
  if (!uses || typeof uses !== 'string') return false;
  if (uses.startsWith('./') || uses.startsWith('../')) return true;
  if (uses.startsWith('docker://')) return /@sha256:[0-9a-f]{64}$/i.test(uses);

  const at = uses.lastIndexOf('@');
  if (at <= 0 || at === uses.length - 1) return false;
  const ref = uses.slice(at + 1);
  if (/^latest$/i.test(ref)) return false;
  if (/^[0-9a-f]{40}$/i.test(ref)) return true;
  return /^v\d+(?:\.\d+){0,2}$/.test(ref);
}

export function isSemverMcpPin(pin) {
  if (!pin || typeof pin !== 'string') return false;
  if (/@latest$/i.test(pin)) return false;
  return /@\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(pin);
}

export function resolveEffectiveRoot(start) {
  // Monorepo 자동 감지: packages/<x>/ 에서 호출되면 워크스페이스 루트로 폴백.
  const candidate = path.resolve(start, '..', '..');
  if (fs.existsSync(path.join(candidate, 'pnpm-workspace.yaml'))) {
    return candidate;
  }
  return start;
}

export function checkSecurityHardening(rawRoot = ROOT) {
  const root = resolveEffectiveRoot(rawRoot);
  const errors = [];
  const warnings = [];
  const stats = {
    workflows: 0,
    jobs: 0,
    actions: 0,
    mcpServers: 0,
    packageSpecs: 0,
  };

  const manifest = readAgentManifest(root, errors);
  const security = manifest?.security || {};

  checkDeadManConfig(security, errors);
  checkWorkflows(root, security, errors, warnings, stats);
  checkMcpPins(manifest?.mcp?.external_servers || [], security, errors, stats);
  checkPackageSupplyChain(root, security, errors, stats);

  return { errors, warnings, stats };
}

function checkDeadManConfig(security, errors) {
  const cfg = security.dead_man_switch || {};
  if (cfg.enabled !== true) {
    errors.push('agent.yaml security.dead_man_switch.enabled must be true');
  }
  if (!Number.isFinite(Number(cfg.max_ci_job_minutes)) || Number(cfg.max_ci_job_minutes) <= 0) {
    errors.push('agent.yaml security.dead_man_switch.max_ci_job_minutes must be a positive number');
  }
  if (cfg.require_explicit_live_opt_in !== true) {
    errors.push('agent.yaml security.dead_man_switch.require_explicit_live_opt_in must be true');
  }
}

function checkWorkflows(root, security, errors, warnings, stats) {
  const workflowsDir = path.join(root, '.github', 'workflows');
  if (!fs.existsSync(workflowsDir)) {
    warnings.push('.github/workflows does not exist; workflow hardening checks skipped');
    return;
  }

  const maxMinutes = Number(security.dead_man_switch?.max_ci_job_minutes || 0);
  const secretPatterns = security.oidc?.static_cloud_secret_patterns || [];
  const workflowFiles = fs.readdirSync(workflowsDir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();

  for (const name of workflowFiles) {
    const rel = path.join('.github', 'workflows', name);
    const file = path.join(root, rel);
    const text = fs.readFileSync(file, 'utf8');
    let doc;
    try {
      doc = YAML.parse(text) || {};
    } catch (e) {
      errors.push(`${rel}: YAML parse failed: ${e.message}`);
      continue;
    }

    stats.workflows += 1;

    if (hasEvent(doc.on, 'pull_request_target')) {
      errors.push(`${rel}: pull_request_target is forbidden`);
    }

    if (!doc.permissions) {
      errors.push(`${rel}: top-level permissions are required`);
    } else if (doc.permissions === 'write-all') {
      errors.push(`${rel}: permissions: write-all is forbidden`);
    }

    const topIdToken = permissionValue(doc.permissions, 'id-token') === 'write';
    const foundCloudSecrets = findStaticSecretRefs(text, secretPatterns);
    if (foundCloudSecrets.length && !topIdToken) {
      errors.push(`${rel}: static cloud credential secret(s) require OIDC id-token: write (${foundCloudSecrets.join(', ')})`);
    }

    for (const [jobId, job] of Object.entries(doc.jobs || {})) {
      stats.jobs += 1;
      const jobName = `${rel} job "${jobId}"`;
      const timeout = Number(job?.['timeout-minutes']);
      if (!Number.isFinite(timeout) || timeout <= 0) {
        errors.push(`${jobName}: timeout-minutes is required`);
      } else if (maxMinutes > 0 && timeout > maxMinutes) {
        errors.push(`${jobName}: timeout-minutes ${timeout} exceeds dead-man max ${maxMinutes}`);
      }

      const jobPermissions = job?.permissions;
      if (jobPermissions === 'write-all') {
        errors.push(`${jobName}: permissions: write-all is forbidden`);
      }

      for (const step of job?.steps || []) {
        if (!step?.uses) continue;
        stats.actions += 1;
        if (!isPinnedActionRef(step.uses)) {
          errors.push(`${jobName}: action "${step.uses}" must be pinned to a SHA or major version tag`);
        }
      }
    }
  }
}

function checkMcpPins(servers, security, errors, stats) {
  const requirePins = security.mcp_pin_required === true
    || security.supply_chain?.require_mcp_semver_pin === true;

  for (const server of servers) {
    stats.mcpServers += 1;
    const name = server.name || '<unnamed>';
    if (server.type === 'http' || server.url) {
      if (!String(server.url || '').startsWith('https://')) {
        errors.push(`mcp.external_servers.${name}: HTTP MCP URLs must use https://`);
      }
      continue;
    }

    if (requirePins && !isSemverMcpPin(server.pin)) {
      errors.push(`mcp.external_servers.${name}: stdio MCP server pin must include an exact semver version`);
    }
  }
}

function checkPackageSupplyChain(root, security, errors, stats) {
  if (security.supply_chain?.package_lock_required !== false) {
    const hasNpmLock = fs.existsSync(path.join(root, 'package-lock.json'));
    const hasPnpmLock = fs.existsSync(path.join(root, 'pnpm-lock.yaml'));
    if (!hasNpmLock && !hasPnpmLock) {
      errors.push('package-lock.json or pnpm-lock.yaml is required for supply-chain reproducibility');
    }
  }

  const pkg = readJson(root, 'package.json', errors);
  if (!pkg) return;

  for (const field of PACKAGE_FIELDS) {
    for (const [name, spec] of Object.entries(pkg[field] || {})) {
      stats.packageSpecs += 1;
      if (!isSafePackageSpec(spec)) {
        errors.push(`package.json ${field}.${name}: version "${spec}" is not allowed in hardened mode`);
      }
    }
  }
}

function isSafePackageSpec(spec) {
  if (typeof spec !== 'string') return false;
  const value = spec.trim();
  if (!value || value === '*' || /^latest$/i.test(value)) return false;
  return !FORBIDDEN_VERSION_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function findStaticSecretRefs(text, patterns) {
  const found = [];
  for (const pattern of patterns) {
    const secretRef = new RegExp(`secrets\\.${escapeRegExp(pattern)}\\b`);
    const plainRef = new RegExp(`\\b${escapeRegExp(pattern)}\\b`);
    if (secretRef.test(text) || plainRef.test(text)) found.push(pattern);
  }
  return [...new Set(found)];
}

function permissionValue(permissions, key) {
  if (!permissions || typeof permissions !== 'object') return undefined;
  return permissions[key];
}

function hasEvent(on, eventName) {
  if (!on) return false;
  if (typeof on === 'string') return on === eventName;
  if (Array.isArray(on)) return on.includes(eventName);
  return Object.prototype.hasOwnProperty.call(on, eventName);
}

function readYaml(root, rel, errors) {
  try {
    return YAML.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  } catch (e) {
    errors.push(`${rel}: load failed: ${e.message}`);
    return null;
  }
}

function readAgentManifest(root, errors) {
  if (fs.existsSync(path.join(root, 'agent.yaml'))) {
    return readYaml(root, 'agent.yaml', errors);
  }
  const monorepoCandidate = path.join(root, 'packages', 'nekowork-cli', 'agent.yaml');
  if (fs.existsSync(monorepoCandidate)) {
    return readYaml(path.dirname(monorepoCandidate), 'agent.yaml', errors);
  }
  return readYaml(root, 'agent.yaml', errors);
}

function readJson(root, rel, errors) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  } catch (e) {
    errors.push(`${rel}: load failed: ${e.message}`);
    return null;
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  const report = checkSecurityHardening(ROOT);
  console.log('HARNESS security-hardening');
  console.log(`  workflows    : ${report.stats.workflows}`);
  console.log(`  jobs         : ${report.stats.jobs}`);
  console.log(`  actions      : ${report.stats.actions}`);
  console.log(`  mcp servers  : ${report.stats.mcpServers}`);
  console.log(`  package specs: ${report.stats.packageSpecs}`);

  if (report.warnings.length) {
    console.log('');
    console.log(`Warnings (${report.warnings.length}):`);
    for (const warning of report.warnings) console.log(`  - ${warning}`);
  }

  if (report.errors.length) {
    console.log('');
    console.log(`Errors (${report.errors.length}):`);
    for (const error of report.errors) console.log(`  - ${error}`);
    process.exit(1);
  }

  console.log('  pass');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
