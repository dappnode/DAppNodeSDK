import chalk from "chalk";
import { ShellError } from "./shell.js";
import { wasTaskOutputStreamed } from "./progress.js";

/**
 * Formats an error for the terminal, once.
 * A failed command whose log was already streamed (verbose/CI) is reported by its summary line only;
 * otherwise the message includes the last lines of its output. Stack frames are shown only with --debug/--verbose.
 */
export function formatCliError(
  error: unknown,
  {
    debug = false,
    outputStreamed = wasTaskOutputStreamed()
  }: { debug?: boolean; outputStreamed?: boolean } = {}
): string {
  const err = error instanceof Error ? error : new Error(String(error));
  const body =
    err instanceof ShellError && err.streamed && outputStreamed
      ? err.summary
      : err.message;
  const [first, ...rest] = body.trimEnd().split("\n");
  const lines = [
    `${chalk.red("✖")} ${first}`,
    ...rest.map(line => `  ${line}`)
  ];
  // `--verbose` is also `--debug`. The stack starts with the message, which is already
  // printed above, so only the frames are added.
  const frames = (err.stack || "")
    .split("\n")
    .filter(line => /^\s+at /.test(line));
  if (debug && frames.length > 0) lines.push(chalk.dim(frames.join("\n")));
  return lines.join("\n");
}
