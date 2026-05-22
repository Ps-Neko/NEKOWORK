// negative: @ts-expect-error is the safer alternative; this rule shouldn't
// flag it (only @ts-ignore / @ts-nocheck do).

// @ts-expect-error intentional type mismatch for test
const x: number = "string" as any;
