import fs from "node:fs";
import path from "node:path";
import { buildArgs, BumpCompose } from "./discovery.js";

export interface ImageSource {
  image: string;
  template: string;
}

export function renderDockerTag(source: ImageSource, version: string): string {
  return source.template.replace(
    /\{version(?:#([^}]*))?\}/g,
    (_, prefix: string | undefined) =>
      prefix && version.startsWith(prefix)
        ? version.slice(prefix.length)
        : version
  );
}

export function extractImageSource(
  content: string,
  arg: string
): ImageSource | null {
  const defaults = new Map<string, string>();
  const lines = content.replace(/\\\r?\n/g, "").split(/\r?\n/);
  for (const line of lines) {
    const match = /^\s*ARG\s+([A-Za-z_][A-Za-z0-9_]*)=(\S+)\s*$/i.exec(line);
    if (match) defaults.set(match[1], match[2].replace(/^["']|["']$/g, ""));
  }
  const expand = (expression: string, seen = new Set<string>()): string =>
    expression.replace(
      /\$\{([A-Za-z_][A-Za-z0-9_]*)(?:#([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
      (
        original,
        braced: string | undefined,
        prefix: string | undefined,
        bare: string | undefined
      ) => {
        const name = braced || bare!;
        if (name === arg)
          return prefix === undefined ? "{version}" : `{version#${prefix}}`;
        if (!defaults.has(name) || seen.has(name)) return original;
        const value = expand(defaults.get(name)!, new Set([...seen, name]));
        return prefix && value.startsWith(prefix)
          ? value.slice(prefix.length)
          : value;
      }
    );
  for (const line of lines) {
    const from = /^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/i.exec(line);
    if (!from) continue;
    const token = expand(from[1]);
    if (!token.includes("{version")) continue;
    const colon = token.lastIndexOf(":");
    if (colon <= token.lastIndexOf("/"))
      throw Error(`Cannot find image tag for ${arg}`);
    const image = token.slice(0, colon);
    const template = token.slice(colon + 1);
    if (
      image.includes("$") ||
      image.includes("{version") ||
      template.includes("$")
    )
      throw Error(`Unresolved Dockerfile argument for ${arg}`);
    return { image, template };
  }
  return null;
}

export function findImageSource(
  dir: string,
  compose: BumpCompose,
  arg: string
): ImageSource | null {
  for (const service of Object.values(compose.services)) {
    if (
      typeof service.build !== "object" ||
      !buildArgs(service).some(([key]) => key === arg)
    )
      continue;
    const file = path.resolve(
      dir,
      service.build.context || ".",
      service.build.dockerfile || "Dockerfile"
    );
    return extractImageSource(fs.readFileSync(file, "utf8"), arg);
  }
  return null;
}
