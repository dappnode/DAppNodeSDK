import { UpstreamItem } from "@dappnode/types";

/** Optional metadata supported before it is published in shared types. */
export type BumpUpstreamItem = UpstreamItem & {
  provider?: string;
  tagPattern?: string;
};
export type Provider = "docker" | "github" | "docker_tags";

export function parseProvider(value: unknown): Provider {
  if (value === undefined) return "docker";
  if (typeof value === "string") {
    switch (value.toLowerCase()) {
      case "docker":
        return "docker";
      case "github":
        return "github";
      case "docker_tags":
      case "docker-tags":
      case "dockerhub":
        return "docker_tags";
    }
  }
  throw Error(`Unknown upstream provider: ${String(value)}`);
}

/** Restrict patterns to constructs shared by JavaScript and Rust regex. */
export function compileTagPattern(value: unknown): RegExp | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw Error("tagPattern must be a string");
  let inClass = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "\\") {
      const escaped = value[++i];
      if (/[1-9]/.test(escaped || "") || escaped === "k")
        throw Error("tagPattern must not use backreferences");
      if (
        escaped &&
        /[a-zA-Z0-9]/.test(escaped) &&
        !/[dDsSwWbBnrtfvxu]/.test(escaped)
      )
        throw Error(
          "tagPattern uses an escape outside the common regex subset"
        );
      if (inClass && escaped === "b")
        throw Error(
          "tagPattern uses a class escape outside the common regex subset"
        );
      continue;
    }
    if (char === "[") inClass = true;
    if (char === "]") inClass = false;
    if (
      !inClass &&
      char === "(" &&
      value[i + 1] === "?" &&
      value[i + 2] !== ":"
    )
      throw Error(
        "tagPattern must use the common regex subset (no lookaround or named groups)"
      );
  }
  return new RegExp(value);
}

export function extractVersion(tag: string, pattern?: string): string | null {
  const regex = compileTagPattern(pattern);
  if (!regex) return tag;
  const match = regex.exec(tag);
  return match ? match[1] ?? match[0] : null;
}
