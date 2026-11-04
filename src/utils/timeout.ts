import timestring from "timestring/index.js";

const defaultBuildTimeout = 60 * 60 * 1000;

/**
 * Parses a timeout and returns milliseconds.
 * - Strings are human-readable durations ("20min", "1h"); a bare integer string ("5000") is seconds.
 * - Numbers are already milliseconds; 0 disables the timeout, as before.
 */
export function parseTimeout(timeout: string | number | undefined): number {
  if (timeout === undefined || timeout === "") return defaultBuildTimeout;
  if (typeof timeout === "number") {
    if (!Number.isFinite(timeout) || timeout < 0)
      throw new Error(`Invalid timeout: ${timeout}`);
    return timeout;
  }
  const trimmed = timeout.trim();
  const parsed = /^\d+$/.test(trimmed)
    ? Number(trimmed) * 1000
    : timestring(trimmed) * 1000;
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`Invalid timeout: ${timeout}`);
  return parsed;
}
