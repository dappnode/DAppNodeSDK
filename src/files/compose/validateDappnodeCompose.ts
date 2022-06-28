import semver from "semver";
import { Manifest } from "../manifest/types";
import { Compose } from "./types";
import { getIsCore } from "../../utils/getIsCore";
import { params } from "./params";

let aggregatedError: string[];

function err(msg: string): void {
  aggregatedError.push(msg);
}

/**
 * Validates against custom dappnode docker compose specs.
 * This function must be executed after the official docker schema
 * @param param0
 */
export function validateDappnodeCompose(
  compose: Compose,
  manifest: Manifest
): void {
  // clean the errors
  aggregatedError = [];
  const isCore = getIsCore(manifest);

  // COMPOSE TOP LEVEL restrictions

  validateComposeVersion(compose);
  validateComposeNetworks(compose);

  // SERVICE LEVEL restrictions

  const servicesNames = Object.keys(compose.services);

  for (const serviceName of servicesNames) {
    validateComposeService(compose, isCore, serviceName, manifest.name);
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
    err(
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
        err(
          `The docker network ${networkName} is not allowed. Only docker networks ${params.DOCKER_WHITELIST_NETWORKS.join(
            ","
          )} are allowed`
        );
      // Check all networks are external
      const network = networks[networkName];
      if (network && network.external === false)
        err(
          `The docker network ${networkName} is not allowed. Docker internal networks are not allowed`
        );
    }
  }
}

/**
 * Ensures the compose keys values are valid for dappnode
 */
function validateComposeService(
  compose: Compose,
  isCore: boolean,
  serviceName: string,
  dnpName: string
): void {
  for (const serviceKey of Object.keys(compose.services[serviceName])) {
    if (!params.SAFE_KEYS.includes(serviceKey))
      err(
        `service ${serviceName} has key ${serviceKey} that is not allowed. Allowed keys are: ${params.SAFE_KEYS.join(
          ","
        )}`
      );
  }

  const { dns, pid, privileged, network_mode, volumes } = compose.services[
    serviceName
  ];

  // Check that if defined, the DNS must be the one provided from the bind package
  if (!isCore && dns && !params.DNS_SERVICE.includes(dns))
    err(`service ${serviceName} has DNS different than ${params.DNS_SERVICE}`);

  // Check compose pid feature can only be used with the format service:*. The pid:host is dangerous
  if (pid && !pid.startsWith("service:"))
    err(`service ${serviceName} has PID feature differnet than service:*`);

  // Check only core packages cand be privileged
  if (!isCore && privileged && privileged === true)
    err(
      `service ${serviceName} has privileged as true but is not a core package`
    );

  // Check Only core packages can use network_mode: host
  if (!isCore && network_mode && network_mode === "host")
    err(
      `service ${serviceName} has network_mode: host but is not a core package`
    );

  validateComposeServiceNetworks(compose, isCore, serviceName);

  if (volumes && !params.DOCKER_WHITELIST_BIND_VOLUMES.includes(dnpName)) {
    for (const [i, volume] of volumes.entries()) {
      if (typeof volume !== "string") {
        // https://docs.docker.com/compose/compose-file/compose-file-v3/#short-syntax-3
        err(
          `service ${serviceName}.volumes[${i}] must use volume short-syntax`
        );
      }

      validateComposeServiceVolumes(compose, serviceName, volume);
    }
  }
}

/**
 * Ensure the services networks are whitelisted
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

  if (Array.isArray(serviceNetworks)) {
    for (const serviceNetwork of serviceNetworks) {
      // Check docker network is whitelisted when defined in array format
      if (!params.DOCKER_WHITELIST_NETWORKS.includes(serviceNetwork))
        err(
          `service ${serviceName} has a non-whitelisted docker network: ${serviceNetwork}. Only docker networks ${DOCKER_WHITELIST_NETWORKS_STR} are allowed`
        );
    }
  } else {
    for (const serviceNetworkObjectName of Object.keys(serviceNetworks)) {
      // Check docker network is whitelisted when defined in object format
      if (!params.DOCKER_WHITELIST_NETWORKS.includes(serviceNetworkObjectName))
        err(
          `service ${serviceName} has a non-whitelisted docker network: ${serviceNetworkObjectName}. Only docker networks ${DOCKER_WHITELIST_NETWORKS_STR} are allowed`
        );

      // Check core aliases are not used by non core packages
      const { aliases } = serviceNetworks[serviceNetworkObjectName];
      if (
        !isCore &&
        aliases &&
        params.DOCKER_CORE_ALIASES.some(coreAlias =>
          aliases.includes(coreAlias)
        )
      ) {
        err(
          `service ${serviceName} has the network ${serviceNetworkObjectName} with reserved docker alias. Aliases ${DOCKER_WHITELIST_ALIASES_STR} are reserved to core packages`
        );
      }
    }
  }
}

/**
 * Ensure only core packages can use bind-mounted volumes
 */
function validateComposeServiceVolumes(
  compose: Compose,
  serviceName: string,
  volume: string
): void {
  // From https://docs.docker.com/compose/compose-file/compose-file-v3/#short-syntax-3
  // docker supports multiple short-syntax. DAppNode only supports exclicit declaration of name
  //
  // # Just specify a path and let the Engine create a volume
  // - /var/lib/mysql              <- NOK
  // # Specify an absolute path mapping
  // - /opt/data:/var/lib/mysql    <- NOK
  // # Path on the host, relative to the Compose file
  // - ./cache:/tmp/cache          <- NOK
  // # User-relative path
  // - ~/configs:/etc/configs/:ro  <- NOK
  // # Named volume
  // - datavolume:/var/lib/mysql   <- OK

  // [volumeName, targetPath, modes]
  const [volumeName, targetPath] = volume.split(":");

  if (!volumeName || !targetPath) {
    return err(`service ${serviceName} volume ${volume} must use short-syntax declaring volume exclitly:
- datavolume:/var/lib/mysql   <- OK
- ./cache:/tmp/cache          <- NOK
bind mounts are forbidden unless explicitly whitelisted. Reach out to DAppNode team for that.
    `);
  }

  // Extra check REDUNDANT but for better UX in case developers use bind-mounts
  if (volumeName.includes("/")) {
    return err(
      `service ${serviceName} volume ${volume} is a bind-mount, only named non-external volumes are allowed`
    );
  }

  // Check volume name contains only valid charaters.
  // Note: this validation is also done by Docker.
  // Note: this also protects against weird paths.
  if (!/^[a-zA-Z0-9_.-]+$/.test(volumeName)) {
    return err(
      `service ${serviceName} volume ${volume} must only include characters [a-zA-Z0-9_.-]`
    );
  }

  // Check that service volumes are defined also at top compose level
  const volumeDefinition = compose.volumes?.[volumeName];
  if (!volumeDefinition)
    return err(
      `service ${serviceName} volume ${volumeName} must have a volume definition at the top-level volumes section`
    );

  // Extra check REDUNDANT but for better UX
  if (volumeDefinition?.external) {
    err(
      `service ${serviceName} volume ${volumeName} is external. Only named non-external volumes are allowed`
    );
  }

  if (Object.keys(volumeDefinition).length > 0) {
    err(
      `service ${serviceName} volume ${volumeName} definition must not set any property`
    );
  }
}
