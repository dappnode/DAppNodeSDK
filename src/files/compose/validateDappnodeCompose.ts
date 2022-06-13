import { Manifest } from "../manifest/types";
import semver from "semver";
import { ComposeService, Compose } from "./types";
import { getIsCore } from "../../utils/getIsCore";
import { params } from "./params";

const aggregatedError = new AggregateError([]);

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
  aggregatedError.errors = [];
  const isCore = getIsCore(manifest);
  try {
    // COMPOSE TOP LEVEL restrictions

    validateComposeVersion(composeUnsafe);
    validateComposeNetworks(composeUnsafe);

    // COMPOSE SERVICE LEVEL restrictions

    const cpServicesNames = Object.keys(composeUnsafe.services);

    for (const cpServiceName of cpServicesNames) {
      validateComposeServicesKeys(composeUnsafe, cpServiceName);
      validateComposeServicesValues(composeUnsafe, isCore, cpServiceName);
      validateComposeServicesNetworks(composeUnsafe, isCore, cpServiceName);
      validateComposeAndComposeServicesVolumes(
        composeUnsafe,
        isCore,
        cpServiceName
      );
    }

    if (aggregatedError.errors.length > 0) throw aggregatedError;
  } catch (e) {
    if (aggregatedError.errors.length > 0)
      e.message += e.message + "\n" + aggregatedError.errors.join("\n");

    throw e;
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
    aggregatedError.errors.push(
      Error(
        `Compose version ${compose.version} is not supported. Minimum version is ${params.MINIMUM_COMPOSE_FILE_VERSION}`
      )
    );
}

/**
 * Ensures the docker compose networks are whitelisted
 */
function validateComposeNetworks(compose: Compose): void {
  const cpNetworks = compose.networks;
  if (cpNetworks) {
    // Check there are only defined whitelisted compose networks
    if (
      Object.keys(cpNetworks).some(
        networkName =>
          params.DOCKER_WHITELIST_NETWORKS.indexOf(networkName) === -1
      )
    )
      aggregatedError.errors.push(
        Error(
          `Only docker networks ${params.DOCKER_WHITELIST_NETWORKS.join(
            ","
          )} are allowed`
        )
      );

    // Check all networks are external
    if (Object.values(cpNetworks).some(network => network.external === false))
      aggregatedError.errors.push(
        Error(`Docker internal networks are not allowed`)
      );
  }
}

/**
 * Ensures the compose keys are whitelisted
 */
function validateComposeServicesKeys(
  compose: Compose,
  cpServiceName: string
): void {
  const composeServiceKeys = Object.keys(compose.services[cpServiceName]);
  if (
    composeServiceKeys.some(
      composeServiceKey => params.SAFE_KEYS.indexOf(composeServiceKey) === -1
    )
  )
    aggregatedError.errors.push(
      Error(
        `Compose service ${cpServiceName} has keys that are not allowed. Allowed keys are: ${params.SAFE_KEYS.join(
          ","
        )}`
      )
    );
}

/**
 * Ensures the compose keys values are valid for dappnode
 */
function validateComposeServicesValues(
  compose: Compose,
  isCore: boolean,
  cpServiceName: string
): void {
  const cpServiceValues = Object.values(compose.services[cpServiceName]);
  // Check that if defined, the DNS must be the one provided from the bind package
  if (
    cpServiceValues.some(
      (service: ComposeService) =>
        service.dns && service.dns !== params.DNS_SERVICE
    )
  )
    aggregatedError.errors.push(
      Error(
        `Compose service ${cpServiceName} has DNS different than ${params.DNS_SERVICE}`
      )
    );

  // Check compose pid feature can only be used with the format service:*. The pid:host is dangerous
  if (
    cpServiceValues.some(
      service => service.pid && !service.pid.startsWith("service:")
    )
  )
    aggregatedError.errors.push(
      Error(
        `Compose service ${cpServiceName} hasPID feature differnet than service:*`
      )
    );

  // Check only core packages cand be privileged
  if (!isCore && cpServiceValues.some(service => service.privileged === true))
    aggregatedError.errors.push(
      Error(
        `Compose service ${cpServiceName} has privileged as true but is not a core package`
      )
    );

  // Check Only core packages can use network_mode: host
  if (
    !isCore &&
    cpServiceValues.some(service => service.network_mode === "host")
  )
    aggregatedError.errors.push(
      Error(
        `Compose service ${cpServiceName} has network_mode: host but is not a core package`
      )
    );
}

/**
 * Ensure the compose services networks are whitelisted
 */
function validateComposeServicesNetworks(
  compose: Compose,
  isCore: boolean,
  cpServiceName: string
): void {
  const cpService = compose.services[cpServiceName];
  const cpServiceNetworks = cpService.networks;
  if (!cpServiceNetworks) return;

  for (const cpServiceNetwork of cpServiceNetworks) {
    if (!cpServiceNetwork) continue;

    if (
      typeof cpServiceNetwork === "string" &&
      !params.DOCKER_WHITELIST_NETWORKS.includes(cpServiceNetwork)
    ) {
      // Check docker network is whitelisted when defined in array format
      aggregatedError.errors.push(
        Error(
          `Compose service ${cpServiceName} has a non-whitelisted docker network. Only docker networks ${params.DOCKER_WHITELIST_NETWORKS.join(
            ","
          )} are allowed`
        )
      );
    } else {
      if (
        Object.keys(cpServiceNetwork).some(
          network => !params.DOCKER_WHITELIST_NETWORKS.includes(network)
        )
      ) {
        // Check docker network is whitelisted when defined in object format
        aggregatedError.errors.push(
          Error(
            `Compose service ${cpServiceName} has a non-whitelisted docker network. Only docker networks ${params.DOCKER_WHITELIST_NETWORKS.join(
              ","
            )} are allowed`
          )
        );
      }

      // Check core aliases are not used by non core packages
      if (
        !isCore &&
        Object.values(cpServiceNetwork)
          .map(networks => networks.aliases)
          .flat()
          .some(alias => alias && params.DOCKER_CORE_ALIASES.includes(alias))
      ) {
        aggregatedError.errors.push(
          Error(
            `Compose service ${cpServiceName} has a reserved docker alias. Aliases ${params.DOCKER_CORE_ALIASES.join(
              ","
            )} are reserved to core packages`
          )
        );
      }
    }
  }
}

/**
 * Ensure only core packages can use bind-mounted volumes
 */
function validateComposeAndComposeServicesVolumes(
  compose: Compose,
  isCore: boolean,
  cpServiceName: string
): void {
  const cpService = compose.services[cpServiceName];
  const cpServiceVolumes = cpService.volumes;
  if (!cpServiceVolumes) return;

  for (const cpServiceVolume of cpServiceVolumes) {
    if (!cpServiceVolume) continue;
    const cpVolumes = compose.volumes;
    if (!cpVolumes) {
      aggregatedError.errors.push(
        Error(
          `Compose service ${cpServiceName} has a volume not allowed. All docker volumes defined at the service level must be defined also at the top level volumes`
        )
      );
      // return due to not having any volumes to check
      return;
    }

    const cpServiceVolumeName = cpServiceVolume.split(":")[0];
    if (!cpServiceVolumeName)
      aggregatedError.errors.push(
        Error(`Compose service ${cpServiceName} has a volume without name`)
      );

    const cpVolumesNames = Object.keys(cpVolumes);
    if (!isCore && !cpVolumesNames.includes(cpServiceVolumeName)) {
      aggregatedError.errors.push(
        Error(
          `Compose service ${cpServiceName} has a bind-mounted volume, Bind.mounted volumes are not allowed. Make sure the compose service volume ${cpServiceVolumeName} is defined in the top level volumes`
        )
      );
    }
  }
}
