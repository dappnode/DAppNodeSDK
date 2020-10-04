import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { Manifest, Compose, ComposeService, ComposeVolumes } from "../types";
import { UPSTREAM_VERSION_VARNAME } from "../params";
import { toTitleCase } from "./format";

const composeFileName = "docker-compose.yml";

/**
 * Get compose path. Without arguments defaults to './docker-compose.yml'
 *
 * @param dir: './folder', [optional] directory to load the manifest from
 * @return path = './dappnode_package.json'
 */
export function getComposePath(dir = "./"): string {
  return path.join(dir, composeFileName);
}

/**
 * Read the docker-compose.
 * Without arguments defaults to write the manifest at './docker-compose.yml'
 *
 * @param dir: './folder', [optional] directory to load the manifest from
 */
export function generateAndWriteCompose(dir: string, manifest: Manifest): void {
  const composeYaml = generateCompose(manifest);
  writeCompose(dir, composeYaml);
}

/**
 * Read a compose data (string, without parsing)
 * Without arguments defaults to write the manifest at './docker-compose.yml'
 *
 * @param dir: './folder', [optional] directory to load the manifest from
 * @return compose object
 */
export function readComposeString(dir: string): string {
  const path = getComposePath(dir);

  // Recommended way of checking a file existance https://nodejs.org/api/fs.html#fs_fs_exists_path_callback
  let data;
  try {
    data = fs.readFileSync(path, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") {
      throw Error(
        `No docker-compose found at ${path}. Make sure you are in a directory with an initialized DNP.`
      );
    } else {
      throw e;
    }
  }

  return data;
}

/**
 * Read a compose parsed data
 * Without arguments defaults to write the manifest at './docker-compose.yml'
 *
 * @param dir: './folder', [optional] directory to load the manifest from
 * @return compose object
 */
export function readCompose(dir: string): Compose {
  const data = readComposeString(dir);

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
 * Without arguments defaults to write the manifest at './docker-compose.yml'
 */
export function writeCompose(dir: string, compose: Compose): void {
  const path = getComposePath(dir);
  const composeString = yaml.dump(compose, { indent: 2 });
  fs.writeFileSync(path, composeString);
}

export function generateCompose(manifest: Manifest): Compose {
  const ensName = manifest.name.replace("/", "_").replace("@", "");

  const service: ComposeService = {
    build: "./build",
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
  { name, version }: { name: string; version: string }
): Compose {
  const serviceCount = Object.keys(compose.services).length;
  if (serviceCount === 0) throw Error(`Compose must have at lest 1 service`);

  for (const [serviceName, service] of Object.entries(compose.services)) {
    if (service.build)
      service.image =
        serviceCount === 1
          ? `${name}:${version}`
          : `${serviceName}.${name}:${version}`;
  }

  return compose;
}

export function removeBuildPropFromCompose(compose: Compose): Compose {
  for (const service of Object.values(compose.services)) {
    delete service.build;
  }
  return compose;
}

export function getComposeImageTags(compose: Compose): string[] {
  return Object.values(compose.services).map(service => service.image);
}

export function parseComposeUpstreamVersion(
  compose: Compose
): string | undefined {
  const upstreamVersions: { name: string; version: string }[] = [];
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

  return upstreamVersions.length === 0
    ? undefined
    : upstreamVersions.length === 1
    ? upstreamVersions[0].version
    : upstreamVersions
        .map(({ name, version }) => (name ? `${name}: ${version}` : version))
        .join(", ");
}
