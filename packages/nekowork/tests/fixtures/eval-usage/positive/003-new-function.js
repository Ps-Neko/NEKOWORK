// positive: Function constructor (eval by proxy)

export function makeFn(body) {
  return new Function("ctx", body);
}
