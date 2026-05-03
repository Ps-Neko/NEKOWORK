import path from 'node:path';

export function buildRoots(defaultRoot) {
  const sourceRoot = path.resolve(process.env.HARNESS_SOURCE_ROOT || defaultRoot);
  const targetRoot = path.resolve(
    process.env.HARNESS_TARGET_ROOT
    || process.env.HARNESS_PROJECT_ROOT
    || sourceRoot,
  );
  return { sourceRoot, targetRoot };
}
