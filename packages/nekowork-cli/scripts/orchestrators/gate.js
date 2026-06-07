// Heavy (@ps-neko/nekowork-harness) gate orchestrator — thin re-export shim.
//
// The full HUMAN_GATE / approve / block body (status derivation, approval-to-
// diff-hash binding, summary + decision writes) is byte-identical to the SLIM
// @ps-neko/nekowork source, so heavy re-exports it instead of carrying a
// drifting copy. Same pattern as _handoff-utils.js. The heavy consumers
// (cli.js, apply.js, ship.js, and the gate/ship unit tests) import these:
//   gateCommand   — cli.js dispatch
//   gateStatus    — apply.js, ship.js
//   approveGate   — ship test
//   blockGate     — gate test
//   _readMarker / _markerTime — internal test hooks (parity with slim)
export {
  gateCommand,
  gateStatus,
  approveGate,
  blockGate,
  _readMarker,
  _markerTime,
} from '@ps-neko/nekowork/scripts/orchestrators/gate.js';
