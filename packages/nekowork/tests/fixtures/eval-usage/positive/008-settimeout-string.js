// positive: setTimeout with a string argument is implicit eval
export function schedule(name) {
  setTimeout("refresh_" + name + "()", 500);
}
