export const CORE_PROFILE_MODULES = [
  'rules-core',
  'agents-core',
  'hooks-runtime',
  'platform-configs',
];

const FORBIDDEN_TRUE_DEFAULTS = [
  'bypass_human_gate',
  'disable_human_gate',
  'disable_codex_review',
  'disable_codex_verification',
  'skip_codex_review',
  'skip_human_gate',
  'no_codex',
  'no_human_gate',
  'unsafe_apply',
  'auto_publish',
  'auto_deploy',
];

const FORBIDDEN_FALSE_DEFAULTS = [
  'human_gate_on_critical',
  'require_codex_verification',
  'codex_review_required',
  'human_gate_required',
];

const FORBIDDEN_MUTATION_POLICIES = new Set([
  'parallel_write',
  'multi_executor',
  'unrestricted',
  'direct_write',
  'bypass_review',
]);

const FORBIDDEN_NETWORK_POLICIES = new Set([
  'allow',
  'full',
  'unrestricted',
]);

export function validateProfileSafety(profilesDoc = {}) {
  const errors = [];
  const warnings = [];
  const profiles = profilesDoc.profiles || {};

  for (const [profileName, profile] of Object.entries(profiles)) {
    const modules = new Set(profile.modules || []);
    for (const required of CORE_PROFILE_MODULES) {
      if (!modules.has(required)) {
        errors.push(`profile "${profileName}" must include core safety module "${required}"`);
      }
    }

    const defaults = profile.defaults || {};
    for (const key of FORBIDDEN_TRUE_DEFAULTS) {
      if (defaults[key] === true) {
        errors.push(`profile "${profileName}" cannot set defaults.${key}=true`);
      }
    }
    for (const key of FORBIDDEN_FALSE_DEFAULTS) {
      if (defaults[key] === false) {
        errors.push(`profile "${profileName}" cannot set defaults.${key}=false`);
      }
    }

    if (FORBIDDEN_MUTATION_POLICIES.has(String(defaults.mutation_policy || '').toLowerCase())) {
      errors.push(`profile "${profileName}" cannot weaken mutation_policy to "${defaults.mutation_policy}"`);
    }
    if (FORBIDDEN_NETWORK_POLICIES.has(String(defaults.outbound_network || '').toLowerCase())) {
      errors.push(`profile "${profileName}" cannot set outbound_network to "${defaults.outbound_network}"`);
    }

    if (profileName === 'security' && defaults.human_gate_on_critical !== true) {
      warnings.push('profile "security" should keep defaults.human_gate_on_critical=true');
    }
  }

  return { errors, warnings };
}
