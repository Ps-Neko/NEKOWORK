export function normalizeFlags(argv, { warn = (m) => console.warn(m) } = {}) {
  const out = [];
  const hasProfileAlready = argv.includes('--profile');
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === '--pack') {
      const value = argv[i + 1];
      warn(`[deprecated] --pack is deprecated; use --profile (will be removed in 0.2.0)`);
      out.push('--profile', value);
      i++;
      continue;
    }

    if (token === '--secure') {
      if (hasProfileAlready) {
        warn(`[deprecated] --secure ignored because --profile is present (will be removed in 0.2.0)`);
        continue;
      }
      warn(`[deprecated] --secure is deprecated; use --profile security (will be removed in 0.2.0)`);
      out.push('--profile', 'security');
      continue;
    }

    if (token === '--strict-quality') {
      warn(`[deprecated] --strict-quality is deprecated; use --strict (will be removed in 0.2.0)`);
      out.push('--strict');
      continue;
    }

    if (token === '--fast') {
      warn(`[deprecated] --fast is a no-op; non-strict is default (will be removed in 0.2.0)`);
      continue;
    }

    out.push(token);
  }
  return out;
}
