import { Manifest } from "../manifest/types";
import semver from "semver";
import { Compose, ComposeVolumes } from "./types";
import { getIsCore } from "../../utils/getIsCore";
import { params } from "./params";

let aggregatedError: string[];

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
  // clean the errors
  aggregatedError = [];
  const isCore = getIsCore(manifest);

  // COMPOSE TOP LEVEL restrictions

  validateComposeVersion(composeUnsafe);
  validateComposeNetworks(composeUnsafe);

  // COMPOSE SERVICE LEVEL restrictions

  const servicesNames = Object.keys(composeUnsafe.services);

  for (const serviceName of servicesNames) {
    validateComposeServiceKeys(composeUnsafe, serviceName);
    validateComposeServiceValues(composeUnsafe, isCore, serviceName);
    validateComposeServiceNetworks(composeUnsafe, isCore, serviceName);

    const serviceVolumes = composeUnsafe.services[serviceName].volumes;
    if (serviceVolumes) {
      for (const serviceVolume of serviceVolumes) {
        // named volume: `some_volume:/some/container/path
        const volumeName = serviceVolume.split(":")[0];
        // Check that all volumes have names
        if (!volumeName)
          aggregatedError.push(
            `Compose service ${serviceName} has the volume ${serviceVolume} without name`
          );

        validateComposeAndComposeServiceVolumes(
          composeUnsafe,
          isCore,
          serviceName,
          volumeName
        );
      }
    }
  }

  if (aggregatedError.length > 0)
    throw Error(
      `Error validating compose file with dappnode requirements:\n\n${aggregatedError.join(
        "\n"
      )}`
    );
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
    aggregatedError.push(
      `Compose version ${compose.version} is not supported. Minimum version is ${params.MINIMUM_COMPOSE_FILE_VERSION}`
    );
}

/**
 * Ensures the docker compose networks are whitelisted
 */
function validateComposeNetworks(compose: Compose): void {
  const networks = compose.networks;

  if (networks) {
    for (const networkName of Object.keys(networks)) {
      // Check there are only defined whitelisted compose networks
      if (!params.DOCKER_WHITELIST_NETWORKS.includes(networkName))
        aggregatedError.push(
          `The docker network ${networkName} is not allowed. Only docker networks ${params.DOCKER_WHITELIST_NETWORKS.join(
            ","
          )} are allowed`
        );
      // Check all networks are external
      if (networks[networkName].external === false)
        aggregatedError.push(
          `The docker network ${networkName} is not allowed. Docker internal networks are not allowed`
        );
    }
  }
}

/**
 * Ensures the compose keys are whitelisted
 */
function validateComposeServiceKeys(
  compose: Compose,
  serviceName: string
): void {
  const serviceKeys = Object.keys(compose.services[serviceName]);
  for (const serviceKey of serviceKeys) {
    if (!params.SAFE_KEYS.includes(serviceKey))
      aggregatedError.push(
        `Compose service ${serviceName} has key ${serviceKey} that is not allowed. Allowed keys are: ${params.SAFE_KEYS.join(
          ","
        )}`
      );
  }
}

/**
 * Ensures the compose keys values are valid for dappnode
 */
function validateComposeServiceValues(
  compose: Compose,
  isCore: boolean,
  serviceName: string
): void {
  // Check that if defined, the DNS must be the one provided from the bind package
  const { dns } = compose.services[serviceName];
  if (!isCore && dns && !params.DNS_SERVICE.includes(dns))
    aggregatedError.push(
      `Compose service ${serviceName} has DNS different than ${params.DNS_SERVICE}`
    );

  // Check compose pid feature can only be used with the format service:*. The pid:host is dangerous
  const { pid } = compose.services[serviceName];
  if (pid && !pid.startsWith("service:"))
    aggregatedError.push(
      `Compose service ${serviceName} has PID feature differnet than service:*`
    );

  // Check only core packages cand be privileged
  const { privileged } = compose.services[serviceName];
  if (!isCore && privileged && privileged === true)
    aggregatedError.push(
      `Compose service ${serviceName} has privileged as true but is not a core package`
    );

  // Check Only core packages can use network_mode: host
  const { network_mode } = compose.services[serviceName];
  if (!isCore && network_mode && network_mode === "host")
    aggregatedError.push(
      `Compose service ${serviceName} has network_mode: host but is not a core package`
    );
}

/**
 * Ensure the compose services networks are whitelisted
 */
function validateComposeServiceNetworks(
  compose: Compose,
  isCore: boolean,
  serviceName: string
): void {
  const DOCKER_WHITELIST_NETWORKS_STR = params.DOCKER_WHITELIST_NETWORKS.join(
    ","
  );
  const DOCKER_WHITELIST_ALIASES_STR = params.DOCKER_CORE_ALIASES.join(",");
  const service = compose.services[serviceName];
  const serviceNetworks = service.networks;
  if (!serviceNetworks) return;

  for (const serviceNetwork of serviceNetworks) {
    if (!serviceNetwork) continue;

    if (typeof serviceNetwork === "string") {
      // Check docker network is whitelisted when defined in array format
      if (!params.DOCKER_WHITELIST_NETWORKS.includes(serviceNetwork))
        aggregatedError.push(
          `Compose service ${serviceName} has a non-whitelisted docker network. Only docker networks ${DOCKER_WHITELIST_NETWORKS_STR} are allowed`
        );
    } else {
      const serviceNetworkObjectNames = Object.keys(serviceNetwork);

      for (const serviceNetworkObjectName of serviceNetworkObjectNames) {
        if (!serviceNetworkObjectName) continue;

        // Check docker network is whitelisted when defined in object format
        if (
          !params.DOCKER_WHITELIST_NETWORKS.includes(serviceNetworkObjectName)
        )
          aggregatedError.push(
            `Compose service ${serviceName} has a non-whitelisted docker network: ${serviceNetworkObjectName}. Only docker networks ${DOCKER_WHITELIST_NETWORKS_STR} are allowed`
          );

        // Check core aliases are not used by non core packages
        const serviceNetworkAliases =
          serviceNetwork[serviceNetworkObjectName].aliases;
        if (
          !isCore &&
          serviceNetworkAliases &&
          params.DOCKER_CORE_ALIASES.some(coreAlias =>
            serviceNetworkAliases.includes(coreAlias)
          )
        ) {
          aggregatedError.push(
            `Compose service ${serviceName} has the network ${serviceNetworkObjectName} with reserved docker alias. Aliases ${DOCKER_WHITELIST_ALIASES_STR} are reserved to core packages`
          );
        }
      }
    }
  }
}

/**
 * Ensure only core packages can use bind-mounted volumes
 */
function validateComposeAndComposeServiceVolumes(
  compose: Compose,
  isCore: boolean,
  serviceName: string,
  volumeName: string
): void {
  // Check that compose service volumes are defined also at top compose level
  const volumeDefinition: ComposeVolumes = compose.volumes?.[volumeName];
  if (!volumeDefinition && !isCore)
    aggregatedError.push(
      `Compose service ${serviceName} has the bind-mounted volume ${volumeName}. Bind-mounted volumes are not allowed and restricted for core packages. Make sure the compose service volume ${volumeName} is defined at the top level volumes`
    );
}
