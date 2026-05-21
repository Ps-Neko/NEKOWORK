import { paint, kvBlock } from './ui-format.js';

export function renderError({ message, examples = [], helpRef }, opts = {}) {
  const lines = [`${paint('err', '✗', opts)} ${message}`, ''];
  if (examples.length) {
    lines.push('  예시:');
    for (const ex of examples) lines.push(`    ${paint('hint', ex, opts)}`);
    lines.push('');
  }
  if (helpRef) lines.push(`  ${paint('dim', '도움말: ' + helpRef, opts)}`);
  return lines.join('\n');
}

export function renderBlocked({ message, fields = [], nextSteps = [] }, opts = {}) {
  const lines = [`${paint('warn', '⚠', opts)} ${message}`, ''];
  if (fields.length) {
    lines.push(kvBlock(fields, opts));
    lines.push('');
  }
  if (nextSteps.length) {
    lines.push(paint('hint', '해결 방법 →', opts));
    for (const { cmd, note } of nextSteps) {
      const left = paint('hint', `  ${cmd}`, opts);
      const right = note ? '  ' + paint('dim', note, opts) : '';
      lines.push(left + right);
    }
  }
  return lines.join('\n');
}
