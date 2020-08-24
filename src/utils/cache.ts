import fs from "fs";
import os from "os";
import path from "path";
import { getImageId } from "./getImageId";

// Local cache specs. Path = $cachePath
type CacheMap = Map<string, string>;

function getCachePath(): string {
  return path.join(
    os.homedir(),
    ".config",
    "dappnodesdk",
    "docker-build-cache.json"
  );
}

export function loadCache(cachePath?: string): CacheMap {
  if (!cachePath) cachePath = getCachePath();

  try {
    const cacheString = fs.readFileSync(cachePath, "utf8");
    try {
      return new Map(Object.entries(JSON.parse(cacheString)));
    } catch (e) {
      console.error(`Error parsing cache ${cachePath}`, e);
      return new Map();
    }
  } catch (e) {
    if (e.code === "ENOENT") return new Map();
    else throw e;
  }
}

export function writeCache(
  { key, value }: { key: string; value: string },
  cachePath?: string
): void {
  if (!cachePath) cachePath = getCachePath();

  const cache = loadCache(cachePath);
  cache.set(key, value);
  const cacheObj: { [key: string]: string } = {};
  for (const [key, value] of cache) cacheObj[key] = value;
  const cacheString = JSON.stringify(cacheObj, null, 2);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, cacheString);
}

/**
 * Returns a single deterministic cache key from an array of image tags
 * @param imageTags
 * @returns "dappmanager.dnp.dappnode.eth:0.2.24/sha256:0d31e5521ef6e92a0efb6110024da8a3517daac4b1e4bbbccaf063ce96641b1b"
 */
export async function getCacheKey(imageTags: string[]): Promise<string> {
  return (
    await Promise.all(
      imageTags
        .sort()
        .map(async imageTag => [imageTag, await getImageId(imageTag)].join("/"))
    )
  ).join(";");
}
