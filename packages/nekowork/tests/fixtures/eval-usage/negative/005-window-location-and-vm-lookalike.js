// negative: window.* / *.eval lookalikes that are NOT dynamic code execution
export function setup() {
  const here = window.location.href;        // property access, not eval
  const out = myvm.runSomething(input);      // not the node vm module
  const score = evaluator.evaluate(data);    // method named evaluate, not eval
  return { here, out, score };
}
