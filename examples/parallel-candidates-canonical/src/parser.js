export function normalizeCommand(input) {
  if (typeof input !== 'string') {
    throw new TypeError('command must be a string');
  }

  return input.trim().toLowerCase().replace(/\s+/g, '-');
}
