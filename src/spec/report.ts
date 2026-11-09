import path from "path";
import chalk from "chalk";
import { SpecFinding, specDocUrl, specRules } from "./rules.js";

/**
 * warn (default): report violations, never fail.
 * error: fail validation on any violation (opt-in today, the planned default).
 * off: skip the checks.
 */
export type SpecMode = "warn" | "error" | "off";

export function getSpecMode(env: NodeJS.ProcessEnv = process.env): SpecMode {
  const value = (env.DAPPNODE_SDK_SPEC || "").trim().toLowerCase();
  return value === "error" || value === "off" ? value : "warn";
}

function relative(file: string | undefined, base: string): string {
  if (!file) return "";
  const rel = path.relative(base, file);
  return rel && !rel.startsWith("..") ? rel : file;
}

export function formatSpecFindings(
  findings: SpecFinding[],
  { base = process.cwd() }: { base?: string } = {}
): string[] {
  return findings.map(({ rule, message, file }) => {
    const where = relative(file, base);
    return `${rule}${where ? ` ${where}` : ""}: ${message}`;
  });
}

export function formatSpecReport(
  findings: SpecFinding[],
  {
    base = process.cwd(),
    mode = "warn"
  }: { base?: string; mode?: SpecMode } = {}
): string {
  const count = `${findings.length} package spec ${
    findings.length === 1 ? "violation" : "violations"
  }`;
  const header =
    mode === "error"
      ? `${chalk.red("✖")} ${count}:`
      : `${chalk.yellow(
          "⚠"
        )} ${count}. These will become errors in a future SDK release:`;
  return [
    header,
    ...formatSpecFindings(findings, { base }).map(line => `  ${line}`),
    `  See ${specDocUrl}`
  ].join("\n");
}

/** GitHub Actions workflow commands, shown as annotations on the run and the pull request. */
export function formatGithubAnnotations(
  findings: SpecFinding[],
  {
    base = process.cwd(),
    level = "warning"
  }: { base?: string; level?: "warning" | "error" } = {}
): string[] {
  const escapeData = (value: string) =>
    value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  const escapeProperty = (value: string) =>
    escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
  return findings.map(({ rule, message, file }) => {
    const props = [
      ...(file ? [`file=${escapeProperty(relative(file, base))}`] : []),
      `title=${escapeProperty(`${rule} ${specRules[rule].title}`)}`
    ];
    return `::${level} ${props.join(",")}::${escapeData(message)}`;
  });
}

/**
 * Prints the findings once, after the task renderer has finished. In error mode the
 * failed validation already listed them, so only the GitHub annotations are added.
 */
export function printSpecReport(
  findings: SpecFinding[],
  {
    env = process.env,
    base = env.GITHUB_WORKSPACE || process.cwd()
  }: { env?: NodeJS.ProcessEnv; base?: string } = {}
): void {
  if (findings.length === 0) return;
  const mode = getSpecMode(env);
  if (mode !== "error")
    console.error(`\n${formatSpecReport(findings, { base, mode })}\n`);
  if (env.GITHUB_ACTIONS === "true")
    for (const line of formatGithubAnnotations(findings, {
      base,
      level: mode === "error" ? "error" : "warning"
    }))
      console.log(line);
}
