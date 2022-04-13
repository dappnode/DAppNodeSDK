import { Manifest } from "../manifest/types";
import semver from "semver";
import { ComposeService, Compose } from "./types";
import { params } from "./params";
import { getIsCore } from "./utils";

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
  const allowedNetworks = params.DOCKER_WHITELIST_NETWORKS.join(",");
  const coreAliases = params.DOCKER_CORE_ALIASES.join(",");

  // COMPOSE TOP LEVEL restrictions

  // Check the minimum docker compose file version is 3.5 or higher
  if (
    semver.lt(
      composeUnsafe.version + ".0",
      params.MINIMUM_COMPOSE_FILE_VERSION + ".0"
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

  // - TODO Ensure that there are only compose service safeKeys
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
          throw Error(`Aliases ${coreAliases} are reserved to core packages`);
        }
      } else {
        throw Error(`Compose service networks must be an array or an object`);
      }
    }
  }

  // Compose service volumes: MUST BE CHECK TOGETHER WITH COMPOSE TOP LEVEL VOLUMES
  const cpServiceVolumes = cpServicesValues
    .map(composeService => composeService.volumes)
    .flat();

  if (cpServiceVolumes.length > 0) {
    for (const cpServiceVolume of cpServiceVolumes) {
      if (!cpServiceVolume) continue;
      const cpVolumes = composeUnsafe.volumes;
      if (!cpVolumes)
        throw Error(
          `All docker volumes defined in the service must be defined in the top level volumes`
        );

      const cpServiceVolumeName = cpServiceVolume.split(":")[0];
      if (!cpServiceVolumeName)
        throw Error("Compose service volume name is empty");

      const cpVolumesNames = Object.keys(cpVolumes);
      if (
        !getIsCore(manifest) &&
        !cpVolumesNames.includes(cpServiceVolumeName)
      ) {
        throw Error(
          `Bind host volumes are not allowed. Make sure the compose service volume ${cpServiceVolumeName} is defined in the top level volumes`
        );
      }
    }
  }
}
