// negative: scoped disable with a specific rule + reason

/* eslint-disable @typescript-eslint/no-explicit-any -- need any here for legacy interop */
export function legacy(x: any) { return x; }
/* eslint-enable @typescript-eslint/no-explicit-any */
