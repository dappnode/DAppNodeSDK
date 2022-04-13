import {
  AllowedFormats,
  Compose,
  PackageImage,
  ReleaseFilePaths,
  ReleaseFileType
} from "../types";
import {
  getImageTag,
  upstreamImageLabel,
  UPSTREAM_VERSION_VARNAME
} from "../params";
import { toTitleCase } from "./format";
import { mapValues, uniqBy } from "lodash";
import { writeReleaseFile } from "../releaseFiles/writeReleaseFile";
import { readReleaseFile } from "../releaseFiles/readReleaseFile";

/**
 * Update service image tag to current version
 * @returns updated imageTags
 */
export function updateComposeImageTags(
  compose: Compose,
  { name: dnpName, version }: { name: string; version: string },
  options?: { editExternalImages?: boolean }
): Compose {
  return {
    ...compose,
    services: mapValues(compose.services, (service, serviceName) => {
      const newImageTag = getImageTag({ dnpName, serviceName, version });
      return service.build
        ? {
            ...service,
            image: newImageTag
          }
        : options?.editExternalImages
        ? {
            ...service,
            image: newImageTag,
            labels: {
              ...(service.labels || {}),
              [upstreamImageLabel]: service.image
            }
          }
        : service;
    })
  };
}

export function getComposePackageImages(
  compose: Compose,
  { name: dnpName, version }: { name: string; version: string }
): PackageImage[] {
  return Object.entries(compose.services).map(
    ([serviceName, service]): PackageImage => {
      const imageTag = getImageTag({ dnpName, serviceName, version });
      return service.build
        ? { type: "local", imageTag }
        : { type: "external", imageTag, originalImageTag: service.image };
    }
  );
}

export function parseComposeUpstreamVersion(
  compose: Compose
): string | undefined {
  let upstreamVersions: { name: string; version: string }[] = [];
  for (const service of Object.values(compose.services))
    if (
      typeof service.build === "object" &&
      typeof service.build.args === "object"
    ) {
      for (const [varName, version] of Object.entries(service.build.args)) {
        if (varName.startsWith(UPSTREAM_VERSION_VARNAME)) {
          const name = varName
            .replace(UPSTREAM_VERSION_VARNAME, "")
            .replace(/^[^a-zA-Z\d]+/, "")
            .replace(/[^a-zA-Z\d]+$/, "");
          upstreamVersions.push({ name: toTitleCase(name), version });
        }
      }
    }

  // Remove duplicated build ARGs (for multi-service)
  upstreamVersions = uniqBy(upstreamVersions, item => item.name);

  return upstreamVersions.length === 0
    ? undefined
    : upstreamVersions.length === 1
    ? upstreamVersions[0].version
    : upstreamVersions
        .map(({ name, version }) => (name ? `${name}: ${version}` : version))
        .join(", ");
}

/**
 * Delete all `build` properties from all services in a disk persisted compose
 */
export function composeDeleteBuildProperties(paths?: ReleaseFilePaths): void {
  const compose = readReleaseFile(ReleaseFileType.compose, paths);
  for (const service of Object.values(compose.releaseFile.services)) {
    delete service.build;
  }
  writeReleaseFile(
    { type: ReleaseFileType.compose, data: compose.releaseFile },
    AllowedFormats.yml,
    paths
  );
}
