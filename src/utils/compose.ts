import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import prettier from "prettier";
import {
  Manifest,
  Compose,
  ComposeService,
  ComposeVolumes,
  PackageImage
} from "../types";
import {
  defaultComposeFileName,
  defaultDir,
  getImageTag,
  upstreamImageLabel,
  UPSTREAM_VERSION_VARNAME
} from "../params";
import { toTitleCase } from "./format";
import { mapValues, uniqBy } from "lodash";
import { readFile } from "./file";

interface ComposePaths {
  /** './folder', [optional] directory to load the compose from */
  dir?: string;
  /** 'manifest-admin.json', [optional] name of the compose file */
  composeFileName?: string;
}

/**
 * Read a compose parsed data
 * Without arguments defaults to write the manifest at './docker-compose.yml'
 * @return compose object
 */
export function readCompose(paths?: ComposePaths): Compose {
  const composePath = getComposePath(paths);
  const data = readFile(composePath);

  // Parse compose in try catch block to show a comprehensive error message
  try {
    const compose = yaml.safeLoad(data);
    if (!compose) throw Error("result is undefined");
    if (typeof compose === "string") throw Error("result is a string");
    return compose as Compose;
  } catch (e) {
    throw Error(`Error parsing docker-compose: ${e.message}`);
  }
}

/**
 * Writes the docker-compose.
 */
export function writeCompose(compose: Compose, paths?: ComposePaths): void {
  const composePath = getComposePath(paths);
  fs.writeFileSync(composePath, stringifyCompose(compose));
}

/**
 * Get compose path. Without arguments defaults to './docker-compose.yml'
 * @return path = './dappnode_package.json'
 */
export function getComposePath(paths?: ComposePaths): string {
  return path.join(
    paths?.dir || defaultDir,
    paths?.composeFileName || defaultComposeFileName
  );
}

function stringifyCompose(compose: Compose): string {
  return prettier.format(yaml.dump(compose, { indent: 2 }), {
    // DAppNode prettier options, to match DAppNodeSDK + DAPPMANAGER
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "none",
    // Built-in parser for YAML
    parser: "yaml"
  });
}

export function generateCompose(manifest: Manifest): Compose {
  const ensName = manifest.name.replace("/", "_").replace("@", "");

  const service: ComposeService = {
    build: ".",
    image: manifest.name + ":" + manifest.version
  };

  // Image name
  service.image = manifest.name + ":" + manifest.version;
  service.restart = manifest.image?.restart || "always";

  // Volumes
  if (manifest.image?.volumes) {
    service.volumes = [
      ...(manifest.image.volumes || []),
      ...(manifest.image.external_vol || [])
    ];
  }

  // Ports
  if (manifest.image?.ports) {
    service.ports = manifest.image.ports;
  }

  // Volumes
  const volumes: ComposeVolumes = {};
  // Regular volumes
  if (manifest.image?.volumes) {
    manifest.image.volumes.map(vol => {
      // Make sure it's a named volume
      if (!vol.startsWith("/") && !vol.startsWith("~")) {
        const volName = vol.split(":")[0];
        volumes[volName] = {};
      }
    });
  }

  // External volumes
  if (manifest.image?.external_vol) {
    manifest.image.external_vol.map(vol => {
      const volName = vol.split(":")[0];
      volumes[volName] = {
        external: {
          name: volName
        }
      };
    });
  }

  const dockerCompose: Compose = {
    version: "3.4",
    services: {
      [ensName]: service
    }
  };
  if (Object.getOwnPropertyNames(volumes).length)
    dockerCompose.volumes = volumes;

  return dockerCompose;
}

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

interface LocalUpstreamVersion {
  serviceName: string;
  currentVersion: string;
}

export function findLocalUpstreamVersion(
  upstreamVariableName: string,
  compose: Compose
): LocalUpstreamVersion {
  const matches: LocalUpstreamVersion[] = [];
  for (const [serviceName, service] of Object.entries(compose.services))
    if (typeof service.build === "object" && service.build.args)
      for (const [argName, argValue] of Object.entries(service.build.args))
        if (argName === upstreamVariableName)
          matches.push({ serviceName, currentVersion: argValue });

  // Tolerate more than one match, it will converge to the same value
  if (matches.length === 0)
    throw Error(`No compose build arg found for name ${upstreamVariableName}`);
  else return matches[0];
}
