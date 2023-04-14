import {
  Compose,
  Manifest,
  PackageBackup,
  SetupWizard
} from "../../../index.js";

/**
 * Important: These types must be in sync with the types from the dappmanager
 * TODO: find a workaraound to avoid duplicating types, move types to new repo toolkit
 */

// STAKERS

export type Network = "mainnet" | "prater" | "gnosis";
export declare const consensusClientsMainnet: readonly [
  "prysm.dnp.dappnode.eth",
  "lighthouse.dnp.dappnode.eth",
  "teku.dnp.dappnode.eth",
  "nimbus.dnp.dappnode.eth",
  "lodestar.dnp.dappnode.eth",
  ""
];
export type ConsensusClientMainnet = typeof consensusClientsMainnet[number];
export declare const executionClientsMainnet: readonly [
  "geth.dnp.dappnode.eth",
  "besu.public.dappnode.eth",
  "erigon.dnp.dappnode.eth",
  "nethermind.public.dappnode.eth",
  ""
];
export type ExecutionClientMainnet = typeof executionClientsMainnet[number];
export type SignerMainnet = "web3signer.dnp.dappnode.eth" | "";
export type MevBoostMainnet = "mev-boost.dnp.dappnode.eth" | "";
export type ConsensusClientPrater =
  | "prysm-prater.dnp.dappnode.eth"
  | "lighthouse-prater.dnp.dappnode.eth"
  | "teku-prater.dnp.dappnode.eth"
  | "nimbus-prater.dnp.dappnode.eth"
  | "lodestar-prater.dnp.dappnode.eth"
  | "";
export type ExecutionClientPrater =
  | "goerli-geth.dnp.dappnode.eth"
  | "goerli-erigon.dnp.dappnode.eth"
  | "goerli-nethermind.dnp.dappnode.eth"
  | "goerli-besu.dnp.dappnode.eth"
  | "";
export type SignerPrater = "web3signer-prater.dnp.dappnode.eth" | "";
export type MevBoostPrater = "mev-boost-goerli.dnp.dappnode.eth" | "";
export type ConsensusClientGnosis =
  | "gnosis-beacon-chain-prysm.dnp.dappnode.eth"
  | "lighthouse-gnosis.dnp.dappnode.eth"
  | "teku-gnosis.dnp.dappnode.eth"
  | "nimbus-gnosis.dnp.dappnode.eth"
  | "lodestar-gnosis.dnp.dappnode.eth"
  | "";
export type ExecutionClientGnosis = "nethermind-xdai.dnp.dappnode.eth" | "";
export type SignerGnosis = "web3signer-gnosis.dnp.dappnode.eth";
export type MevBoostGnosis = "mev-boost-gnosis.dnp.dappnode.eth" | "";
export type StakerType = "execution" | "consensus" | "signer" | "mev-boost";
export type ExecutionClient<T extends Network> = T extends "mainnet"
  ? ExecutionClientMainnet
  : T extends "gnosis"
  ? ExecutionClientGnosis
  : T extends "prater"
  ? ExecutionClientPrater
  : never;
export type ConsensusClient<T extends Network> = T extends "mainnet"
  ? ConsensusClientMainnet
  : T extends "gnosis"
  ? ConsensusClientGnosis
  : T extends "prater"
  ? ConsensusClientPrater
  : never;
export type Signer<T extends Network> = T extends "mainnet"
  ? SignerMainnet
  : T extends "gnosis"
  ? SignerGnosis
  : T extends "prater"
  ? SignerPrater
  : never;
export type MevBoost<T extends Network> = T extends "mainnet"
  ? MevBoostMainnet
  : T extends "gnosis"
  ? MevBoostGnosis
  : T extends "prater"
  ? MevBoostPrater
  : never;
export type StakerItem<T extends Network, P extends StakerType> =
  | StakerItemOk<T, P>
  | StakerItemError<T, P>;
interface StakerExecution<T extends Network> {
  dnpName: ExecutionClient<T>;
}
interface StakerConsensus<T extends Network> {
  dnpName: ConsensusClient<T>;
  useCheckpointSync?: boolean;
}
interface StakerSigner<T extends Network> {
  dnpName: Signer<T>;
}
interface StakerMevBoost<T extends Network> {
  dnpName: MevBoost<T>;
  relays?: string[];
}

export interface StakerConfigGet<T extends Network> {
  executionClients: StakerItem<T, "execution">[];
  consensusClients: StakerItem<T, "consensus">[];
  web3Signer: StakerItem<T, "signer">;
  mevBoost: StakerItem<T, "mev-boost">;
  feeRecipient: string;
}

export interface StakerConfigSet<T extends Network> {
  network: T;
  feeRecipient: string;
  executionClient?: StakerItemOk<T, "execution">;
  consensusClient?: StakerItemOk<T, "consensus">;
  mevBoost?: StakerItemOk<T, "mev-boost">;
  enableWeb3signer?: boolean;
}

export interface PackageRelease {
  dnpName: string;
  reqVersion: string;
  semVersion: string;
  imageFile: DistributedFile;
  avatarFile?: DistributedFile;
  metadata: Manifest;
  compose: Compose;
  warnings: ReleaseWarnings;
  origin?: string;
  isCore: boolean;
  /** Release is from safe origin OR has trusted signature */
  signedSafe: boolean;
  signatureStatus: ReleaseSignatureStatus;
}

export type StakerItemData = Pick<
  PackageRelease,
  | "dnpName"
  | "reqVersion"
  | "semVersion"
  | "imageFile"
  | "avatarFile"
  | "metadata"
  | "warnings"
  | "origin"
  | "signedSafe"
>;

type StakerItemBasic<
  T extends Network,
  P extends StakerType
> = P extends "execution"
  ? StakerExecution<T>
  : P extends "consensus"
  ? StakerConsensus<T>
  : P extends "signer"
  ? StakerSigner<T>
  : P extends "mev-boost"
  ? StakerMevBoost<T>
  : never;

export type StakerItemError<T extends Network, P extends StakerType> = {
  status: "error";
  error: string;
} & StakerItemBasic<T, P>;

export type StakerItemOk<T extends Network, P extends StakerType> = {
  status: "ok";
  avatarUrl: string;
  isInstalled: boolean;
  isUpdated: boolean;
  isRunning: boolean;
  data?: StakerItemData;
  isSelected: boolean;
} & StakerItemBasic<T, P>;

// SIGNATURES

export type DistributedFileSource = "ipfs" | "swarm";
export interface DistributedFile {
  hash: string;
  source: DistributedFileSource;
  size: number;
}

interface ReleaseWarnings {
  /**
   * If a core package does not come from the DAppNode Package APM registry
   */
  coreFromForeignRegistry?: boolean;
  /**
   * If the requested name does not match the manifest name
   */
  requestNameMismatch?: boolean;
}

export declare enum ReleaseSignatureStatusCode {
  notSigned = "notSigned",
  signedByKnownKey = "signedByKnownKey",
  signedByUnknownKey = "signedByUnknownKey"
}

export type ReleaseSignatureStatus =
  | {
      status: ReleaseSignatureStatusCode.notSigned;
    }
  | {
      status: ReleaseSignatureStatusCode.signedByKnownKey;
      keyName: string;
    }
  | {
      status: ReleaseSignatureStatusCode.signedByUnknownKey;
      signatureProtocol: string;
      key: string;
    };

// PACKAGES

export interface InstalledPackageDataApiReturn extends InstalledPackageData {
  updateAvailable: UpdateAvailable | null;
}

export interface UpdateAvailable {
  newVersion: string;
  upstreamVersion?: string;
}

export type InstalledPackageData = Pick<
  PackageContainer,
  | "dnpName"
  | "instanceName"
  | "version"
  | "isDnp"
  | "isCore"
  | "dependencies"
  | "avatarUrl"
  | "origin"
  | "chain"
  | "domainAlias"
  | "canBeFullnode"
> & {
  containers: PackageContainer[];
};

export interface PackageContainer {
  /**
   * Docker container ID
   * ```
   * "3edc051920c61e02ff9c42cf35caf4f48f693d65f44d6652de29e9024f051405"
   * ```
   */
  containerId: string;
  /**
   * Docker container name
   * ```
   * "DAppNodeCore-mypackage.dnp.dappnode.eth"
   * ```
   */
  containerName: string;
  /**
   * ENS domain name of this container's package
   * ```
   * "mypackage.dnp.dappnode.eth"
   * ```
   */
  dnpName: string;
  /**
   * Docker compose service name of this container, as declared in its package docker-compose
   * ```
   * "frontend"
   * ```
   */
  serviceName: string;
  /**
   * Name given by the user when installing an instance of a package
   * ```
   * "my-package-test-instance"
   * ```
   */
  instanceName: string;
  /**
   * Semantic version of this container's package
   * ```
   * "0.1.0"
   * ```
   */
  version: string;
  created: number;
  image: string;
  ip?: string;
  state: any;
  running: boolean;
  exitCode: number | null;
  ports: any[];
  volumes: any[];
  networks: {
    name: string;
    ip: string;
  }[];
  isDnp: boolean;
  isCore: boolean;
  defaultEnvironment?: any;
  defaultPorts?: any[];
  defaultVolumes?: any[];
  dependencies: any;
  avatarUrl: string;
  origin?: string;
  chain?: any;
  domainAlias?: string[];
  canBeFullnode?: boolean;
  isMain?: boolean;
  dockerTimeout?: number;
}

export interface InstalledPackageDetailData extends InstalledPackageData {
  setupWizard?: SetupWizard;
  userSettings?: UserSettings;
  gettingStarted?: string;
  gettingStartedShow?: boolean;
  backup?: PackageBackup[];
  /** Checks if there are volumes to be removed on this DNP */
  areThereVolumesToRemove: boolean;
  dependantsOf: string[];
  updateAvailable: UpdateAvailable | null;
  notRemovable: boolean;
  manifest?: Manifest;
  /** Arbitrary data sent by the package */
  packageSentData: Record<string, string>;
}

export interface UserSettings {
  environment?: {
    [serviceName: string]: {
      /**
       * ```js
       * { MODE: "VALUE_SET_BEFORE" }
       * ```
       */
      [envName: string]: string;
    };
  };
  portMappings?: {
    [serviceName: string]: {
      /**
       * ```js
       * { "8443": "8443", "8443/udp": "8443" },
       * ```
       */
      [containerPortAndType: string]: string;
    };
  };
  namedVolumeMountpoints?: {
    /**
     * ```js
     * { data: "/media/usb0" }
     * ```
     */
    [volumeName: string]: string;
  };
  allNamedVolumeMountpoint?: string;
  fileUploads?: {
    [serviceName: string]: {
      /**
       * ```js
       * { "/usr/src/app/config.json": "data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D" }
       * ```
       */
      [containerPath: string]: string;
    };
  };
  domainAlias?: string[];
  legacyBindVolumes?: {
    [serviceName: string]: {
      [volumeName: string]: string;
    };
  };
}
