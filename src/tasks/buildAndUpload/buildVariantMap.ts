import path from "path";
import { parseArchitectures } from "../../utils/parseArchitectures.js";
import {
  readCompose,
  getComposePackageImages,
  parseComposeUpstreamVersion,
  readManifest
} from "../../files/index.js";
import { Compose, Manifest } from "@dappnode/types";
import { defaultComposeFileName, singleVariantName } from "../../params.js";
import { BuildVariantsMap, BuildVariantsMapEntry } from "../../types.js";

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
}): BuildVariantsMap {
  if (!variants || variants.length === 0)
    return { [singleVariantName]: createVariantMapEntry({ rootDir, composeFileName }) };

  const map: BuildVariantsMap = {};

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
  const manifestPaths = [{ dir: rootDir }];
  const composePaths = [{ dir: rootDir, composeFileName }];

  if (variantPath) {
    manifestPaths.push({ dir: variantPath });
    composePaths.push({ dir: variantPath, composeFileName });
  }

  const { manifest, format: manifestFormat } = readManifest(manifestPaths);
  const compose = readCompose(composePaths);

  const { name: dnpName, version } = manifest;

  // TODO: Handle upstream object defined case
  if (!manifest.upstream)
    manifest.upstreamVersion = getUpstreamVersion({ compose, manifest });

  return {
    manifest,
    manifestFormat,

    compose,

    releaseDir: getReleaseDirPath({ rootDir, dnpName, version }),
    manifestPaths,
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
