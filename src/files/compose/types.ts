export interface ComposeInspectVolumes {
  // volumeName: "dncore_ipfsdnpdappnodeeth_data"
  [volumeName: string]: {
    // Allowed to user
    external?: boolean | { name: string }; // name: "dncore_ipfsdnpdappnodeeth_data"
    // NOT allowed to user, only used by DAppNode internally (if any)
    name?: string; // Volumes can only be declared locally or be external
    driver?: string; // Dangerous
    driver_opts?:
      | { type: "none"; device: string; o: "bind" }
      | { [driverOptName: string]: string }; // driver_opts are passed down to whatever driver is being used, there's. No verification on docker's part nor detailed documentation
    labels?: { [labelName: string]: string }; // User should not use this feature
  };
}

export interface ComposeServiceBuild {
  context?: string; // ./dir
  dockerfile?: string; // Dockerfile-alternate
  args?: { [varName: string]: string }; // { buildno: 1}
}

/**
 * Docker compose file-
 * Ref: https://docs.docker.com/compose/compose-file/compose-file-v3/#depends_on
 */
export interface ComposeService {
  build?: string | ComposeServiceBuild;
  cap_add?: string[];
  cap_drop?: string[];
  command?: string;
  container_name?: string; // "DAppNodeCore-dappmanager.dnp.dappnode.eth";
  depends_on?: string[];
  dns?: string;
  devices?: string[];
  entrypoint?: string;
  environment?: { [key: string]: string } | string[];
  env_file?: string[];
  expose?: string[];
  extra_hosts?: string[];
  healthcheck?: {
    test: string | string[];
    interval?: string;
    timeout?: string;
    start_period?: string;
    retries?: string | number;
  };
  image: string;
  labels?: { [labelName: string]: string };
  logging?: {
    driver?: string;
    options?: {
      [optName: string]: string | number | null;
    };
  };
  networks?: ComposeServiceNetworks;
  network_mode?: string;
  ports?: string[];
  pid?: string;
  privileged?: boolean;
  restart?: string;
  security_opt?: string | string[];
  stop_grace_period?: string;
  stop_signal?: string;
  user?: string;
  volumes?: string[]; // ["dappmanagerdnpdappnodeeth_data:/usr/src/app/dnp_repo/"];
  working_dir?: string;
}

export interface PackageEnvs {
  [envName: string]: string;
}

export interface ComposeServiceNetwork {
  ipv4_address?: string;
  aliases?: string[];
}

export type ComposeServiceNetworks = string[] | ComposeServiceNetworksObj;

export type ComposeServiceNetworksObj = {
  [networkName: string]: ComposeServiceNetwork;
};

export interface ComposeNetworks {
  /** networkName: "dncore_network" */
  [networkName: string]: ComposeNetwork | null;
}

export interface ComposeNetwork {
  external?: boolean;
  driver?: string; // "bridge";
  ipam?: {
    config: {
      /** subnet: "172.33.0.0/16" */
      subnet: string;
    }[];
  };
  name?: string;
}

export interface Compose {
  version: string; // "3.4"
  // dnpName: "dappmanager.dnp.dappnode.eth"
  services: {
    [dnpName: string]: ComposeService;
  };
  networks?: ComposeNetworks;
  // { dappmanagerdnpdappnodeeth_data: {} };
  volumes?: ComposeVolumes;
}

export interface ComposeVolumes {
  /** volumeName: "dncore_ipfsdnpdappnodeeth_data" */
  [volumeName: string]: ComposeVolume | null;
}

export interface ComposeVolume {
  // FORBIDDEN
  // external?: boolean | { name: string }; // name: "dncore_ipfsdnpdappnodeeth_data"
  // NOT allowed to user, only used by DAppNode internally (if any)
  external?: boolean;
  name?: string; // Volumes can only be declared locally or be external
  driver?: string; // Dangerous
  driver_opts?:
    | { type: "none"; device: string; o: "bind" }
    | { [driverOptName: string]: string }; // driver_opts are passed down to whatever driver is being used, there's. No verification on docker's part nor detailed documentation
  labels?: { [labelName: string]: string }; // User should not use this feature
}

export interface ComposePaths {
  /** './folder', [optional] directory to load the compose from */
  dir?: string;
  /** 'manifest-admin.json', [optional] name of the compose file */
  composeFileName?: string;
}
