import type { LogLevel } from "./config.js";

type Fields = Record<string, unknown>;

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger(level: LogLevel) {
  const threshold = levelRank[level];

  function log(lvl: LogLevel, msg: string, fields?: Fields) {
    if (levelRank[lvl] < threshold) return;
    const line = {
      ts: new Date().toISOString(),
      level: lvl,
      msg,
      ...(fields ? { fields } : {}),
    };
    // Keep logs on stderr so stdio transport stays clean.
    console.error(JSON.stringify(line));
  }

  return {
    debug: (msg: string, fields?: Fields) => log("debug", msg, fields),
    info: (msg: string, fields?: Fields) => log("info", msg, fields),
    warn: (msg: string, fields?: Fields) => log("warn", msg, fields),
    error: (msg: string, fields?: Fields) => log("error", msg, fields),
  };
}

