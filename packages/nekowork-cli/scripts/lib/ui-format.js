const TONES = {
  ok:   '\x1b[32m',
  warn: '\x1b[33m',
  err:  '\x1b[31m',
  hint: '\x1b[36m',
  dim:  '\x1b[90m',
  reset: '\x1b[0m',
};

export function isColorEnabled({ env = process.env, isTTY = process.stdout.isTTY } = {}) {
  if (env.NO_COLOR) return false;
  if (!isTTY) return false;
  return true;
}

export function paint(tone, text, { force, noColor } = {}) {
  const enabled = noColor === true ? false : (force === true ? true : isColorEnabled());
  if (!enabled) return text;
  const code = TONES[tone] || '';
  return `${code}${text}${TONES.reset}`;
}

export function nextBlock(items, opts = {}) {
  const lines = [paint('hint', 'Next →', opts)];
  for (const { cmd, note } of items) {
    const left = paint('hint', `  ${cmd}`, opts);
    const right = note ? '  ' + paint('dim', note, opts) : '';
    lines.push(left + right);
  }
  return lines.join('\n');
}

export function kvBlock(rows, opts = {}) {
  const width = Math.max(...rows.map(([k]) => k.length));
  return rows.map(([k, v]) => {
    const key = paint('dim', k.padEnd(width), opts);
    return `  ${key}  ${v}`;
  }).join('\n');
}

export function usageStatusLine({ model = 'unknown', session = null, weekly = null } = {}) {
  const parts = [`[${oneLine(model) || 'unknown'}]`];
  const sessionPart = quotaWindow('세션', session, { showHours: true });
  const weeklyPart = quotaWindow('주간', weekly);
  if (sessionPart) parts.push(sessionPart);
  if (weeklyPart) parts.push(weeklyPart);
  return parts.join(' | ');
}

function quotaWindow(label, quota, { showHours = false } = {}) {
  if (!quota) return null;
  const percent = formatPercent(quota.remainingPercent);
  if (percent == null) return null;

  const duration = showHours && quota.windowHours
    ? `(${formatNumber(quota.windowHours)}h)`
    : '';
  const reset = quota.resetLabel
    ? ` (${oneLine(quota.resetLabel)} 리셋)`
    : '';

  return `${label}${duration} 남음 ${percent}%${reset}`;
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return String(Math.round(Math.max(0, Math.min(100, n))));
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return oneLine(value);
  return String(n);
}

function oneLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}
