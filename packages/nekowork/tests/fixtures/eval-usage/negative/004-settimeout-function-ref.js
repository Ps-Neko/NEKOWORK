// negative: setTimeout/setInterval with a function reference (the safe form)
export function start(onTick) {
  setTimeout(onTick, 100);
  setInterval(() => onTick(), 1000);
  setTimeout(function () { cleanup(); }, 500);
}
