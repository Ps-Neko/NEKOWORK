// negative: boolean flag fallback

export const verboseLogging = process.env.LOG_VERBOSE === "true" ? true : false;
export const debugMode = process.env.DEBUG || "false";
