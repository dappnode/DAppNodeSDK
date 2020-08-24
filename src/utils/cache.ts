import fs from "fs";
import os from "os";
import path from "path";
import { getImageId, getImageIds } from "./getImageId";

// Local cache specs. Path = $cachePath
type CacheMap = Map<string, string>;

/**
 * Get cache path in common location
 */
function getCachePath(): string {
  return path.join(
    os.homedir(),
    ".config",
    "dappnodesdk",
    "docker-build-cache.json"
  );
}

/**
 * Read and parse local cache file
 */
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

/**
 * Add entry to local cache
 */
export function writeToCache(
  { key, value }: { key: string; value: string },
  cachePath?: string
): void {
  if (!cachePath) cachePath = getCachePath();

  const cache = loadCache(cachePath);
  cache.set(key, value);
  writeCache(cache, cachePath);
}

/**
 * Stringify and write cacheMap to local cache file
 */
export function writeCache(cache: CacheMap, cachePath?: string): void {
  if (!cachePath) cachePath = getCachePath();

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

/**
 * Prune local cache by removing entries of images that are no longer in disk
 * @param cachePath
 */
export async function pruneCache(cachePath?: string): Promise<void> {
  if (!cachePath) cachePath = getCachePath();
  if (fs.existsSync(cachePath)) {
    const cache = loadCache(cachePath);
    const imageIds = await getImageIds();
    const prunedCache = _pruneCache(cache, imageIds);
    writeCache(prunedCache, cachePath);
  }
}

/**
 * Pure function version of pruneCache to ease testing
 * @param cache
 * @param imageIds ["6b74b6ba423e, "4a67065ab84a"]
 */
export function _pruneCache(cache: CacheMap, imageIds: string[]): CacheMap {
  for (const [cacheImageId] of cache) {
    // Remove entry if no image ID is included in the cache key digest
    if (imageIds.every(imageId => !cacheImageId.includes(imageId)))
      cache.delete(cacheImageId);
  }
  return cache;
}
