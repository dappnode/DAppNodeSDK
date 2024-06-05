import path from "path";
import { parseArchitectures } from "../../utils/parseArchitectures.js";
import {
  getComposePath,
  readCompose,
  getComposePackageImages,
  parseComposeUpstreamVersion,
  readManifest
} from "../../files/index.js";
import { VariantsMap, BuildVariantsMapEntry } from "./types.js";
import { Compose, Manifest } from "@dappnode/types";
import { defaultComposeFileName } from "../../params.js";

export function buildVariantMap({
  variants,
  rootDir,
  variantsDirPath,
  composeFileName = defaultComposeFileName
}: {
  variants: string[] | null;
  rootDir: string;
  variantsDirPath: string;
  composeFileName?: string;
}): VariantsMap {
  if (!variants || variants.length === 0)
    return { default: createVariantMapEntry({ rootDir, composeFileName }) };

  const map: VariantsMap = {};

  for (const variant of variants) {
    const variantPath = path.join(variantsDirPath, variant);
    map[variant] = createVariantMapEntry({
      rootDir,
      composeFileName,
      variantPath
    });
  }

  return map;
}

export function createVariantMapEntry({
  rootDir,
  composeFileName,
  variantPath
}: {
  rootDir: string;
  composeFileName: string;
  variantPath?: string;
}): BuildVariantsMapEntry {
  const { manifest, format } = variantPath
    ? readManifest([{ dir: rootDir }, { dir: variantPath }])
    : readManifest([{ dir: rootDir }]);

  const { name: dnpName, version } = manifest;

  const composePaths = [getComposePath({ dir: rootDir, composeFileName })];

  if (variantPath)
    composePaths.push(getComposePath({ dir: variantPath, composeFileName }));

  const compose = variantPath
    ? readCompose([
        { dir: rootDir, composeFileName },
        { dir: variantPath, composeFileName }
      ])
    : readCompose([{ dir: rootDir, composeFileName }]);

  // TODO: Handle upstream object defined case
  if (!manifest.upstream)
    manifest.upstreamVersion = getUpstreamVersion({ compose, manifest });

  return {
    manifest,
    manifestFormat: format,

    compose,

    releaseDir: getReleaseDirPath({ rootDir, dnpName, version }),
    composePaths,

    images: getComposePackageImages(compose, manifest),

    architectures: parseArchitectures({
      rawArchs: manifest.architectures
    })
  };
}

function getUpstreamVersion({
  compose,
  manifest
}: {
  compose: Compose;
  manifest: Manifest;
}): string | undefined {
  return (
    parseComposeUpstreamVersion(compose) ||
    process.env.UPSTREAM_VERSION ||
    manifest.upstreamVersion
  );
}

function getReleaseDirPath({
  rootDir,
  dnpName,
  version
}: {
  rootDir: string;
  dnpName: string;
  version: string;
}): string {
  return path.join(rootDir, `build_${dnpName}_${version}`);
}
