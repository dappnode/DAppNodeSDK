import {
  mapValues,
  omitBy,
  pick,
  isObject,
  isEmpty,
  fromPairs,
  sortBy,
  toPairs
} from "lodash";
import { getImageTag } from "../../params";
import { Manifest } from "../manifest/types";
import { params } from "./params";
import { Compose, ComposeService, PackageEnvs } from "./types";
import { getIsCore } from "./utils";

export function parseToProductionCompose({
  composeSafe,
  manifest
}: {
  composeSafe: Compose;
  manifest: Manifest;
}): Compose {
  const dnpName = manifest.name;
  const version = manifest.version;
  const isCore = getIsCore(manifest);

  return cleanCompose({
    version: composeSafe.version,
    services: mapValues(
      composeSafe.services,
      (serviceSafe: ComposeService, serviceName: string) => {
        return sortServiceKeys({
          // Overridable defaults
          restart: "unless-stopped",
          logging: {
            driver: "json-file",
            options: {
              "max-size": "10m",
              "max-file": "3"
            }
          },

          // Mandatory values
          container_name: getContainerName({ dnpName, serviceName, isCore }),
          image: getImageTag({ serviceName, dnpName, version }),
          environment: parseEnvironment(serviceSafe.environment || {}),
          dns: params.DNS_SERVICE, // Common DAppNode ENS
          networks: serviceSafe.networks
        });
      }
    ),
    volumes: composeSafe.volumes,
    networks: composeSafe.networks
  });
}

// Utils

/**
 * Cleans empty or null properties
 * Critical step to prevent writing faulty docker-compose.yml files
 * that can kill docker-compose calls.
 * - Removes service first levels keys that are objects or arrays and
 *   are empty (environment, env_files, ports, volumes)
 * @param compose
 */
function cleanCompose(compose: Compose): Compose {
  return {
    version: compose.version,
    ...omitBy(compose, isOmitable),
    services: mapValues(compose.services, service => ({
      ...omitBy(service, isOmitable),
      // Add mandatory properties for the ts compiler
      ...pick(service, ["container_name", "image"])
    }))
  };
}

function getContainerName({
  dnpName,
  serviceName,
  isCore
}: {
  dnpName: string;
  serviceName: string;
  isCore: boolean;
}): string {
  // Note: _PREFIX variables already end with the character "-"
  return [
    isCore ? params.CONTAINER_CORE_NAME_PREFIX : params.CONTAINER_NAME_PREFIX,
    getContainerDomain({ dnpName, serviceName })
  ].join("");
}

/**
 * Get a unique domain per container, considering multi-service packages
 */
function getContainerDomain({
  dnpName,
  serviceName
}: {
  serviceName: string;
  dnpName: string;
}): string {
  if (!serviceName || serviceName === dnpName) {
    return dnpName;
  } else {
    return [serviceName, dnpName].join(".");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isOmitable(value: any): boolean {
  return (
    value === undefined || value === null || (isObject(value) && isEmpty(value))
  );
}

/**
 * Sort service keys alphabetically, for better readibility
 * @param service
 */
function sortServiceKeys(service: ComposeService): ComposeService {
  return fromPairs(sortBy(toPairs(service), "0")) as ComposeService;
}

/**
 * Parses dappnode package by adding defualt values critical for dappnode
 */
function parseEnvironment(envsArray: string[] | PackageEnvs): PackageEnvs {
  // Make sure ENVs are in array format
  if (typeof envsArray === "object" && !Array.isArray(envsArray))
    return envsArray;

  return envsArray
    .filter(row => (row || "").trim())
    .reduce((envs: PackageEnvs, row) => {
      const [key, value] = (row || "").trim().split(/=(.*)/);
      return key ? { ...envs, [key]: value || "" } : envs;
    }, {});
}
