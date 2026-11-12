import fs from "fs";
import path from "path";
import { BumpCompose, getBuildArgs } from "./discovery.js";

/**
 * The image a Dockerfile `FROM` line builds on. In `template`, the image tag,
 * `{version}` stands for the upstream arg and `{version#prefix}` for
 * `${ARG#prefix}`.
 */
export interface ImageSource {
  image: string;
  template: string;
}

/**
 * Renders the image tag that `source` uses for an upstream version.
 */
export function renderDockerTag(source: ImageSource, version: string): string {
  return source.template.replace(
    /\{version(?:#([^}]*))?\}/g,
    (_match, prefix?: string) => removePrefix(version, prefix)
  );
}

/**
 * Returns the image of the first `FROM` line whose tag uses `arg`, or null when
 * no `FROM` uses it. Other args are replaced by their static `ARG NAME=value`
 * defaults.
 */
export function extractImageSource(
  dockerfile: string,
  arg: string
): ImageSource | null {
  // Join line continuations so each instruction is on one line
  const lines = dockerfile.replace(/\\\r?\n/g, "").split(/\r?\n/);
  const argDefaults = getArgDefaults(lines);

  for (const line of lines) {
    const from = /^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/i.exec(line);
    if (!from) continue;

    const imageRef = expandArgs(from[1], arg, argDefaults);
    if (imageRef.includes("{version")) return splitImageRef(imageRef, arg);
  }

  return null;
}

/**
 * Reads the Dockerfile of the compose service that declares `arg` and returns
 * the image whose tag uses it.
 */
export function findImageSource(
  dir: string,
  compose: BumpCompose,
  arg: string
): ImageSource | null {
  for (const service of Object.values(compose.services)) {
    if (typeof service.build !== "object") continue;
    if (!getBuildArgs(service).some(([name]) => name === arg)) continue;

    const dockerfilePath = path.resolve(
      dir,
      service.build.context || ".",
      service.build.dockerfile || "Dockerfile"
    );
    return extractImageSource(fs.readFileSync(dockerfilePath, "utf8"), arg);
  }

  return null;
}

function getArgDefaults(lines: string[]): Map<string, string> {
  const argDefaults = new Map<string, string>();
  for (const line of lines) {
    const match = /^\s*ARG\s+([A-Za-z_][A-Za-z0-9_]*)=(\S+)\s*$/i.exec(line);
    if (match) argDefaults.set(match[1], match[2].replace(/^["']|["']$/g, ""));
  }
  return argDefaults;
}

/**
 * Replaces `$NAME`, `${NAME}` and `${NAME#prefix}` in a Dockerfile expression.
 * The upstream arg becomes the `{version}` placeholder, other args their
 * default. Args without a default are kept as they are.
 */
function expandArgs(
  expression: string,
  arg: string,
  argDefaults: Map<string, string>,
  expanding = new Set<string>()
): string {
  return expression.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?:#([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (original, bracedName?: string, prefix?: string, bareName?: string) => {
      const name = bracedName || bareName || "";
      if (name === arg)
        return prefix === undefined ? "{version}" : `{version#${prefix}}`;

      const defaultValue = argDefaults.get(name);
      if (defaultValue === undefined || expanding.has(name)) return original;

      const value = expandArgs(
        defaultValue,
        arg,
        argDefaults,
        new Set([...expanding, name])
      );
      return removePrefix(value, prefix);
    }
  );
}

function splitImageRef(imageRef: string, arg: string): ImageSource {
  const tagSeparator = imageRef.lastIndexOf(":");
  if (tagSeparator <= imageRef.lastIndexOf("/"))
    throw Error(`Cannot find image tag for ${arg}`);

  const image = imageRef.slice(0, tagSeparator);
  const template = imageRef.slice(tagSeparator + 1);
  if (image.includes("$") || image.includes("{version"))
    throw Error(`Unresolved Dockerfile argument for ${arg}`);
  if (template.includes("$"))
    throw Error(`Unresolved Dockerfile argument for ${arg}`);

  return { image, template };
}

function removePrefix(value: string, prefix?: string): string {
  if (prefix && value.startsWith(prefix)) return value.slice(prefix.length);
  return value;
}
