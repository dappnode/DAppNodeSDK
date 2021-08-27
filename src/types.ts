// CLI types

export interface CliGlobalOptions {
  dir?: string;
  compose_file_name?: string;
  silent?: boolean;
  verbose?: boolean;
}

export interface ListrContextBuildAndPublish {
  // Build and upload
  releaseHash: string;
  releaseMultiHash: string;
  // create Github release
  nextVersion: string;
  txData: TxData;
}

// Interal types

export enum FileFormat {
  JSON = "JSON",
  YAML = "YAML",
  TEXT = "TEXT"
}

export enum ManifestFormat {
  json = "json",
  yml = "yml",
  yaml = "yaml"
}

export type Architecture = "linux/amd64" | "linux/arm64";
export const architectures: Architecture[] = ["linux/amd64", "linux/arm64"];
export const defaultArch = "linux/amd64";

export type ReleaseType = "major" | "minor" | "patch";
export const releaseTypes: ReleaseType[] = ["major", "minor", "patch"];

export type PackageImageLocal = {
  type: "local";
  imageTag: string;
};
export type PackageImageExternal = {
  type: "external";
  imageTag: string;
  originalImageTag: string;
};
export type PackageImage = PackageImageLocal | PackageImageExternal;

export interface TxData {
  to: string;
  value: number;
  data: string;
  gasLimit: number;
  ensName: string;
  currentVersion: string;
  releaseMultiHash: string;
  developerAddress?: string;
}

export interface TxDataShortKeys {
  r: string; // repoName
  v: string; // version
  h: string; // hash
  d?: string; // developerAddress
}

export interface Manifest {
  name: string;
  version: string;
  upstreamVersion?: string;
  upstreamRepo?: string;
  upstreamArg?: string;
  description?: string;
  type?: string;
  author?: string;
  license?: string;
  avatar?: string;
  repository?: {
    type?: string;
    url?: string;
    directory?: string;
  };
  categories?: string[];
  links?: {
    homepage?: string;
    ui?: string;
    api?: string;
    gateway?: string;
    [linkName: string]: string | undefined;
  };
  architectures?: Architecture[];
  // Extra injected props
  setupWizard?: Record<string, string>;
}

export interface ComposeVolumes {
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

export interface ComposeService {
  build?: string | ComposeServiceBuild;
  container_name?: string; // "DAppNodeCore-dappmanager.dnp.dappnode.eth";
  image: string; // "dappmanager.dnp.dappnode.eth:0.2.6";
  volumes?: string[]; // ["dappmanagerdnpdappnodeeth_data:/usr/src/app/dnp_repo/"];
  ports?: string[];
  environment?: { [key: string]: string } | string[];
  labels?: { [labelName: string]: string };
  env_file?: string[];
  // ipv4_address: "172.33.1.7";
  networks?: string[] | { [networkName: string]: { ipv4_address: string } };
  dns?: string; // "172.33.1.2";
  restart?: string; // "always";
  privileged?: boolean;
  cap_add?: string[];
  cap_drop?: string[];
  devices?: string[];
  network_mode?: string;
  command?: string;
  entrypoint?: string;
  // Logging
  logging?: {
    driver?: string;
    options?: {
      [optName: string]: string | number | null;
    };
  };
}

export interface Compose {
  version: string; // "3.4"
  // dnpName: "dappmanager.dnp.dappnode.eth"
  services: {
    [dnpName: string]: ComposeService;
  };
  networks?: {
    [networkName: string]: {
      external?: boolean;
      driver?: string; // "bridge";
      ipam?: { config: { subnet: string }[] }; // { subnet: "172.33.0.0/16" }
    };
  };
  volumes?: ComposeVolumes; // { dappmanagerdnpdappnodeeth_data: {} };
}
