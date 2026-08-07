// Minimal leveled logger. Swaps console.log/error/warn calls scattered across
// the codebase for a single, timestamped, level-tagged entry point without
// pulling in a full logging library.
function write(level, args) {
  const consoleMethod = level === "debug" ? "log" : level;
  // eslint-disable-next-line no-console
  console[consoleMethod](`[${new Date().toISOString()}] [${level.toUpperCase()}]`, ...args);
}

const logger = {
  debug: (...args) => write("debug", args),
  info: (...args) => write("info", args),
  warn: (...args) => write("warn", args),
  error: (...args) => write("error", args),
};

export default logger;
