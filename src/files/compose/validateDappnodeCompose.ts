import { Manifest } from "../manifest/types";
import semver from "semver";
import { ComposeService, Compose } from "./types";
import { getIsCore } from "../../utils/getIsCore";
import { params } from "./params";

/**
 * Validates against custom dappnode docker compose specs.
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
  const allowedNetworks = params.DOCKER_WHITELIST_NETWORKS.join(",");
  const coreAliases = params.DOCKER_CORE_ALIASES.join(",");
  const isCore = getIsCore(manifest);

  // COMPOSE TOP LEVEL restrictions

  validateComposeVersion(composeUnsafe);
  validateComposeNetworks(composeUnsafe, allowedNetworks);

  // COMPOSE SERVICE LEVEL restrictions

  const cpServicesValues = Object.values(composeUnsafe.services);

  validateComposeServicesKeys(composeUnsafe);
  validateComposeServicesValues(cpServicesValues, isCore);
  validateComposeServicesNetworks(
    cpServicesValues,
    allowedNetworks,
    isCore,
    coreAliases
  );

  // Compose service volumes: MUST BE CHECK TOGETHER WITH COMPOSE TOP LEVEL VOLUMES
  const cpServiceVolumes = cpServicesValues
    .map(composeService => composeService.volumes)
    .flat();

  if (cpServiceVolumes.length > 0) {
    validateComposeAndComposeServicesVolumes(
      composeUnsafe,
      cpServiceVolumes,
      isCore
    );
  }
}

/**
 * Ensures the docker compose version is supported
 */
function validateComposeVersion(compose: Compose): void {
  if (
    semver.lt(
      compose.version + ".0",
      params.MINIMUM_COMPOSE_FILE_VERSION + ".0"
    )
  )
    throw Error(
      `Compose version ${compose.version} is not supported. Minimum version is ${params.MINIMUM_COMPOSE_FILE_VERSION}`
    );
}

/**
 * Ensures the docker compose networks are whitelisted
 */
function validateComposeNetworks(
  compose: Compose,
  allowedNetworks: string
): void {
  const cpNetworks = compose.networks;
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
}

/**
 * Ensures the compose keys are whitelisted
 */
function validateComposeServicesKeys(compose: Compose): void {
  const composeServicesKeys = Object.keys(compose.services);
  const composeSafeServiceKeys = params.SAFE_KEYS;

  for (const composeServiceKey of composeServicesKeys) {
    if (!composeSafeServiceKeys.includes(composeServiceKey))
      throw Error(`Compose service key ${composeServiceKey} is not allowed`);
  }
}

/**
 * Ensures the compose keys values are valid for dappnode
 */
function validateComposeServicesValues(
  cpServicesValues: ComposeService[],
  isCore: boolean
): void {
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
    !isCore &&
    cpServicesValues.some(service => service.privileged === true)
  ) {
    throw Error(`Only core packages can have privileged set to true`);
  }

  // Check Only core packages can use network_mode: host
  if (
    !isCore &&
    cpServicesValues.some(service => service.network_mode === "host")
  ) {
    throw Error(`Only core packages can use network_mode: host`);
  }
}

/**
 * Ensure the compose services networks are whitelisted
 */
function validateComposeServicesNetworks(
  cpServicesValues: ComposeService[],
  allowedNetworks: string,
  isCore: boolean,
  coreAliases: string
): void {
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
          !isCore &&
          Object.values(cpServiceNetwork)
            .map(networks => networks.aliases)
            .flat()
            .some(alias => alias && params.DOCKER_CORE_ALIASES.includes(alias))
        ) {
          throw Error(`Aliases ${coreAliases} are reserved to core packages`);
        }
      } else {
        throw Error(`Compose service networks must be an array or an object`);
      }
    }
  }
}

/**
 * Ensure docker compose and docker compose volumes fullfill the dappnode requirements.
 * Only core compose can use bind mounts
 */
function validateComposeAndComposeServicesVolumes(
  compose: Compose,
  cpServiceVolumes: (string | undefined)[],
  isCore: boolean
): void {
  for (const cpServiceVolume of cpServiceVolumes) {
    if (!cpServiceVolume) continue;
    const cpVolumes = compose.volumes;
    if (!cpVolumes)
      throw Error(
        `All docker volumes defined in the service must be defined in the top level volumes`
      );

    const cpServiceVolumeName = cpServiceVolume.split(":")[0];
    if (!cpServiceVolumeName)
      throw Error("Compose service volume name is empty");

    const cpVolumesNames = Object.keys(cpVolumes);
    if (!isCore && !cpVolumesNames.includes(cpServiceVolumeName)) {
      throw Error(
        `Bind host volumes are not allowed. Make sure the compose service volume ${cpServiceVolumeName} is defined in the top level volumes`
      );
    }
  }
}
