// positive: Node vm module running an assembled code string
import vm from "node:vm";

export function runScript(userScript) {
  const context = vm.createContext({});
  return vm.runInNewContext(userScript, context);
}
