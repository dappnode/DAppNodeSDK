import path from "path";
import { parseArchitectures } from "../../utils/parseArchitectures.js";
import {
  getComposePath,
  readCompose,
  getComposePackageImages,
  parseComposeUpstreamVersion,
  readManifest
} from "../../files/index.js";
import { VariantsMap, VariantsMapEntry } from "./types.js";
import { Compose, Manifest } from "@dappnode/types";

export function buildVariantMap({
  variants,
  rootDir,
  variantsDirPath,
  composeFileName
}: {
  variants?: string[];
  rootDir: string;
  variantsDirPath: string;
  composeFileName: string;
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
}): VariantsMapEntry {
  const { manifest, format } = variantPath
    ? readManifest({ dir: rootDir }, { dir: path.join(rootDir, variantPath) })
    : readManifest({ dir: rootDir });

  const { name: dnpName, version } = manifest;

  const composePaths = [
    getComposePath({ dir: rootDir, composeFileName }),
    ...(variantPath
      ? getComposePath({ dir: variantPath, composeFileName })
      : [])
  ];

  const compose = variantPath
    ? readCompose(
        { dir: rootDir, composeFileName },
        { dir: path.join(rootDir, variantPath), composeFileName }
      )
    : readCompose({ dir: rootDir, composeFileName });

  const upstreamVersion = getUpstreamVersion({ compose, manifest });
  manifest.upstreamVersion = upstreamVersion;

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
