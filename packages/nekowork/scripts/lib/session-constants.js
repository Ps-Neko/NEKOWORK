// Shared session evidence constants.
//
// SUMMARY_FILES and MARKERS describe the per-stage summary artifacts and gate
// markers a session writes under .harness/state/sessions/<id>/. They were
// previously duplicated in lib/decision.js and orchestrators/report.js and had
// drifted (report.js was missing preverify-summary.json + report-summary.json).
// Both modules now import from here so the evidence surface can never diverge.
export const SUMMARY_FILES = [
  'ask.json',
  'auto-summary.json',
  'build-summary.json',
  'work-summary.json',
  'preverify-summary.json',
  'verify-summary.json',
  'ship-summary.json',
  'pr-prep-summary.json',
  'gate-summary.json',
  'apply-summary.json',
  'run-summary.json',
  'report-summary.json',
];

export const MARKERS = [
  'HUMAN_GATE',
  'GATE_APPROVED',
  'GATE_BLOCKED',
  'NO_SHIP',
  'SHIP_READY',
  'APPLIED_DIFF',
];
