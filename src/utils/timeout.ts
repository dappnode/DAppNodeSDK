// timestring does not have a @types package
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import timestring from "timestring";

// Define build timeout (60 min)
const defaultBuildTimeout = 60 * 60 * 1000;

/**
 * Parses a timeout string and returns a number in miliseconds
 * @param timeout "20min", "5000", undefined
 */
export function parseTimeout(timeout: string | undefined): number {
  switch (typeof timeout) {
    case "number": {
      return timeout;
    }
    case "string": {
      if (!timeout) defaultBuildTimeout;
      // Timestring returns in seconds
      const parsedString = timestring(timeout) || parseInt(timeout);
      if (!parsedString) throw Error(`Error parsing timeout: ${timeout}`);
      return parsedString * 1000;
    }
    default:
      return defaultBuildTimeout;
  }
}
