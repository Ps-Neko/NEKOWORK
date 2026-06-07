// Heavy (@ps-neko/nekowork-harness) report orchestrator — thin re-export shim.
//
// The full session-report body (evidence reading, status derivation, Trust Card
// + markdown rendering) is byte-identical to the SLIM @ps-neko/nekowork source,
// so heavy re-exports it instead of carrying a drifting copy. Same pattern as
// _handoff-utils.js. The heavy consumers (cli.js, auto.js, pr-prep.js, and the
// build/report unit tests) import these symbols:
//   reportSession         — public entry (cli.js, auto.js, build/report tests)
//   _deriveStatus         — pr-prep.js
//   _readSessionEvidence  — pr-prep.js
export {
  reportSession,
  _deriveStatus,
  _readSessionEvidence,
} from '@ps-neko/nekowork/scripts/orchestrators/report.js';
