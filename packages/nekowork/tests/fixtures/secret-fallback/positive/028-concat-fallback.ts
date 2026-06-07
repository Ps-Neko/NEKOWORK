// positive: concatenated string fallback after || hides a hardcoded secret
export const apiKey = process.env.SECRET ?? ("a" + "b" + "c");
