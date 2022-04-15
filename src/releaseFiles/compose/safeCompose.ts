import { Manifest } from "../manifest/types";
import semver from "semver";
import {
  ComposeService,
  Compose,
  PackageEnvs,
  ComposeServiceNetworksObj
} from "./types";
import { params } from "./params";
import {
  sortBy,
  toPairs,
  fromPairs,
  mapValues,
  omitBy,
  pick,
  isObject,
  isEmpty
} from "lodash";
import { getImageTag } from "../../params";

const allowedNetworks = params.DOCKER_WHITELIST_NETWORKS.join(",");

/**
 * Validates agains custom dappnode docker compose specs.
 * This function must be executed after the official docker schema
 * @param param0
 */
export function validateDappnodeCompose({
  composeUnsafe,
  manifest
}: {
  composeUnsafe: Compose;
  manifest: Manifest;
}): void {
  // COMPOSE TOP LEVEL restrictions

  // Check the minimum docker compose file version is 3.5 or higher
  if (
    semver.lte(
      composeUnsafe.version + ".0",
      params.MINIMUM_COMPOSE_FILE_VERSION
    )
  )
    throw Error(
      `Compose version ${composeUnsafe.version} is not supported. Minimum version is ${params.MINIMUM_COMPOSE_FILE_VERSION}`
    );

  const cpNetworks = composeUnsafe.networks;
  if (cpNetworks) {
    // Check there are only defined whitelisted compose networks
    if (
      Object.keys(cpNetworks).some(
        networkName =>
          params.DOCKER_WHITELIST_NETWORKS.indexOf(networkName) === -1
      )
    )
      throw Error(`Only docker networks ${allowedNetworks} are allowed`);

    // Check all networks are external
    if (Object.values(cpNetworks).some(network => network.external === false))
      throw Error(`Docker internal networks are not allowed`);
  }

  // COMPOSE SERVICE LEVEL restrictions

  const cpServices = composeUnsafe.services;

  // - Ensure that there are only compose service safeKeys
  const composeServicesKeys = Object.keys(composeUnsafe.services);
  // Validate types with interface: https://betterprogramming.pub/runtime-data-validation-from-typescript-interfaces-1001ad22e775

  const cpServicesValues = Object.values(cpServices);

  // Check that if defined, the DNS must be the one provided from the bind package
  if (
    cpServicesValues.some(
      (service: ComposeService) =>
        service.dns && service.dns !== params.DNS_SERVICE
    )
  )
    throw Error("DNS service must be set to " + params.DNS_SERVICE);

  // Check compose pid feature can only be used with the format service:*. The pid:host is dangerous
  if (
    cpServicesValues.some(
      service => service.pid && !service.pid.startsWith("service:")
    )
  )
    throw Error(`Only pid 'service:* is allowed`);

  // Check only core packages cand be privileged
  if (
    !getIsCore(manifest) &&
    cpServicesValues.some(service => service.privileged === true)
  ) {
    throw Error(`Only core packages can have privileged set to true`);
  }

  // Check Only core packages can use network_mode: host
  if (
    !getIsCore(manifest) &&
    cpServicesValues.some(service => service.network_mode === "host")
  ) {
    throw Error(`Only core packages can use network_mode: host`);
  }

  // Check service networks
  const cpServiceNetworks = cpServicesValues.map(
    composeService => composeService.networks
  );
  if (cpServiceNetworks.length > 0) {
    for (const cpServiceNetwork of cpServiceNetworks) {
      if (!cpServiceNetwork) continue;

      if (
        Array.isArray(cpServiceNetwork) &&
        cpServiceNetwork.some(
          network => !params.DOCKER_WHITELIST_NETWORKS.includes(network)
        )
      ) {
        // Check docker network is whitelisted when defined in array format
        throw Error(`Only docker networks ${allowedNetworks} are allowed`);
      } else if (!Array.isArray(cpServiceNetwork)) {
        if (
          Object.keys(cpServiceNetwork).some(
            network => !params.DOCKER_WHITELIST_NETWORKS.includes(network)
          )
        ) {
          // Check docker network is whitelisted when defined in object format
          throw Error(`Only docker networks ${allowedNetworks} are allowed`);
        }

        // Check core aliases are not used by non core packages
        if (
          !getIsCore(manifest) &&
          Object.values(cpServiceNetwork)
            .map(networks => networks.aliases)
            .flat()
            .some(alias => alias && params.DOCKER_CORE_ALIASES.includes(alias))
        ) {
          throw Error(
            `Aliases ${params.DOCKER_CORE_ALIASES.join(
              ","
            )} are reserved to core packages`
          );
        }
      } else {
        throw Error(`Compose service networks must be an array or an object`);
      }
    }
  }

  // Compose service volumes: MUST BE CHECK TOGETHER WITH COMPOSE TOP LEVEL VOLUMES
  const cpServiceVolumes = cpServicesValues.map(
    composeService => composeService.volumes
  );

  if (cpServiceVolumes.length > 0) {
    for (const cpServiceVolume of cpServiceVolumes) {
      if (!cpServiceVolume) continue;
    }
  }
}

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

function getIsCore(manifest: Manifest): boolean {
  return manifest.type === "dncore";
}
