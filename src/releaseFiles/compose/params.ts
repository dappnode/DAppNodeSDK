export const params = {
  CONTAINER_NAME_PREFIX: "DAppNodePackage-",
  CONTAINER_CORE_NAME_PREFIX: "DAppNodeCore-",
  CONTAINER_TOOL_NAME_PREFIX: "DAppNodeTool-",
  DOCKER_WHITELIST_NETWORKS: ["dncore_network", "dnpublic_network"],
  DOCKER_CORE_ALIASES: [
    "dappmanager.dappnode",
    "wifi.dappnode",
    "vpn.dappnode",
    "wireguard.dappnode",
    "ipfs.dappnode",
    "bind.dappnode"
  ],
  DNS_SERVICE: "172.33.1.2",
  MINIMUM_COMPOSE_FILE_VERSION: "3.5"
};
