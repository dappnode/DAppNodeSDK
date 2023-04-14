import { PackageToInstall, StakerConfigSet } from "./types.js";

export const localIpfsApiUrl = `http://172.33.1.5:5001`;

export const localDappmanagerTestApiUrl = `http://172.33.1.7:7000`;

export const stakerMainnetConfig: StakerConfigSet<"mainnet"> = {
  network: "mainnet",
  feeRecipient: "0x0000000000000000000000000000000000000001",
  executionClient: {
    dnpName: "geth.dnp.dappnode.eth",
    status: "ok",
    avatarUrl: "",
    isInstalled: true,
    isRunning: true,
    isSelected: true,
    isUpdated: true
  },
  consensusClient: {
    dnpName: "prysm.dnp.dappnode.eth",
    status: "ok",
    avatarUrl: "",
    isInstalled: true,
    isRunning: true,
    isSelected: true,
    isUpdated: true
  },
  enableWeb3signer: true,
  mevBoost: {
    dnpName: "mev-boost.dnp.dappnode.eth",
    status: "ok",
    avatarUrl: "",
    isInstalled: true,
    isRunning: true,
    isSelected: true,
    isUpdated: true,
    relays: []
  }
};

export const stakerPraterConfig: StakerConfigSet<"prater"> = {
  network: "prater",
  feeRecipient: "0x0000000000000000000000000000000000000001",
  executionClient: {
    dnpName: "goerli-besu.dnp.dappnode.eth",
    status: "ok",
    avatarUrl: "",
    isInstalled: true,
    isRunning: true,
    isSelected: true,
    isUpdated: true
  },
  consensusClient: {
    dnpName: "lighthouse-prater.dnp.dappnode.eth",
    status: "ok",
    avatarUrl: "",
    isInstalled: true,
    isRunning: true,
    isSelected: true,
    isUpdated: true
  },
  enableWeb3signer: true,
  mevBoost: {
    dnpName: "mev-boost-goerli.dnp.dappnode.eth",
    status: "ok",
    avatarUrl: "",
    isInstalled: true,
    isRunning: true,
    isSelected: true,
    isUpdated: true,
    relays: []
  }
};

export const stakerGnosisConfig: StakerConfigSet<"gnosis"> = {
  network: "gnosis",
  feeRecipient: "0x0000000000000000000000000000000000000001",
  executionClient: {
    dnpName: "nethermind-xdai.dnp.dappnode.eth",
    status: "ok",
    avatarUrl: "",
    isInstalled: true,
    isRunning: true,
    isSelected: true,
    isUpdated: true
  },
  consensusClient: {
    dnpName: "teku-gnosis.dnp.dappnode.eth",
    status: "ok",
    avatarUrl: "",
    isInstalled: true,
    isRunning: true,
    isSelected: true,
    isUpdated: true
  },
  enableWeb3signer: true
};

export const nonStakerPackagesSetup: PackageToInstall[] = [
  {
    dnpName: "dms.dnp.dappnode.eth",
    version: "*" // Latest version
  },
  {
    dnpName: "dappnode-exporter.dnp.dappnode.eth",
    version: "*" // Latest version
  }
];

export const packagesToKeep = [
  stakerMainnetConfig.executionClient.dnpName,
  stakerGnosisConfig.executionClient.dnpName,
  stakerPraterConfig.executionClient.dnpName,
  stakerMainnetConfig.consensusClient.dnpName,
  stakerGnosisConfig.consensusClient.dnpName,
  stakerPraterConfig.consensusClient.dnpName,
  "mev-boost.dnp.dappnode.eth",
  "mev-boost-goerli.dnp.dappnode.eth",
  "web3signer.dnp.dappnode.eth",
  "web3signer-gnosis.dnp.dappnode.eth",
  "web3signer-prater.dnp.dappnode.eth",
  ...nonStakerPackagesSetup.map(p => p.dnpName)
];
