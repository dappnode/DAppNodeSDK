/**
 * MANIFEST
 */
export interface Manifest {
  // Package metadata
  name: string;
  version: string;
  upstreamVersion?: string;
  upstreamRepo?: string;
  upstreamArg?: string;
  shortDescription?: string;
  description?: string;
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

  // Docker instructions
  type?: "service" | "library" | "dncore";
  chain?: ChainDriver;
  mainService?: string;
  /** "15min" | 3600 */
  dockerTimeout?: string;
  dependencies?: Dependencies;
  requirements?: {
    minimumDappnodeVersion: string;
  };
  globalEnvs?: {
    all?: boolean;
  };
  architectures?: Architecture[];

  // Safety properties to solve problematic updates
  runOrder?: string[];
  restartCommand?: string;
  restartLaunchCommand?: string;

  // Install instructions
  changelog?: string;
  warnings?: {
    onInstall?: string;
    onPatchUpdate?: string;
    onMinorUpdate?: string;
    onMajorUpdate?: string;
    onReset?: string;
    onRemove?: string;
  };
  updateAlerts?: ManifestUpdateAlert[];
  disclaimer?: {
    message: string;
  };

  // Package features
  backup?: PackageBackup[];
  gettingStarted?: string;
  style?: {
    featuredBackground?: string;
    featuredColor?: string;
    featuredAvatarFilter?: string;
  };

  // Monitoring
  grafanaDashboards?: GrafanaDashboard[];
  prometheusTargets?: PrometheusTarget[];

  // Network metadata
  exposable?: ExposableServiceManifestInfo[];

  // setupWizard for compacted manifests in core packages
  setupWizard?: SetupWizard;
}

// Metrics
export interface GrafanaDashboard {
  uid: string;
}

export interface PrometheusTarget {
  targets: string[];
  labels?: {
    job?: string;
    group?: string;
  };
}

// Update warnings
export interface ManifestUpdateAlert {
  from: string;
  to: string;
  message: string;
}

export interface PackageBackup {
  name: string;
  path: string;
  service?: string;
}

export interface Dependencies {
  [dependencyName: string]: string;
}

// Driver

export type ChainDriver = ChainDriverType | ChainDriverSpecs;

export type ChainDriverSpecs = {
  driver: ChainDriverType;
  serviceName?: string;
  portNumber?: number;
};

export type ChainDriverType =
  | "bitcoin"
  | "ethereum"
  | "ethereum-beacon-chain"
  | "ethereum2-beacon-chain-prysm"
  | "monero";

export const chainDriversTypes: ChainDriverType[] = [
  "bitcoin",
  "ethereum",
  "ethereum-beacon-chain",
  "ethereum2-beacon-chain-prysm",
  "monero"
];

// HTTPS ports
export interface ExposableServiceManifestInfo {
  name: string;
  description?: string;
  serviceName?: string;
  fromSubdomain?: string;
  port: number;
  exposeByDefault?: boolean;
}

// Arch

export type Architecture = "linux/amd64" | "linux/arm64";

// ============================================================

/**
 * Setup-wizard
 */
export interface SetupWizard {
  version: "2";
  fields: SetupWizardField[];
}

export interface SetupWizardField {
  id: string;
  target?: UserSettingTarget; // Allow form questions
  // UI
  title: string;
  description: string;
  secret?: boolean;
  // Validation options
  pattern?: string;
  patternErrorMessage?: string;
  enum?: string[];
  required?: boolean;
  if?: SetupSchema | { [id: string]: SetupSchema };
}

export type SetupSchema = {
  type?: string;
  title?: string;
  description?: string;
  default?: string;
  enum?: string[];
  pattern?: string;
  customErrors?: { pattern?: string };
  required?: string[];
  properties?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
  };
  dependencies?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oneOf?: any[];
};

export type UserSettingTarget =
  | { type: "environment"; name: string; service?: string[] | string }
  | { type: "portMapping"; containerPort: string; service?: string }
  | { type: "namedVolumeMountpoint"; volumeName: string }
  | { type: "allNamedVolumesMountpoint" }
  | { type: "fileUpload"; path: string; service?: string };

// ============================================================

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

export enum AllowedFormats {
  json = "json",
  yml = "yml",
  yaml = "yaml"
}

export type ReleaseType = "major" | "minor" | "patch";
export const releaseTypes: ReleaseType[] = ["major", "minor", "patch"];

export const architectures: Architecture[] = ["linux/amd64", "linux/arm64"];
export const defaultArch = "linux/amd64";

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
