import { Network, StakerConfigSet } from "./types.js";

export const localIpfsApiUrl = `http://172.33.1.5:5001`;
export const localDappmanagerTestApiUrl = `http://172.33.1.7:7000`;

export const getStakerConfigByNetwork = (
  network: Network
): StakerConfigSet<Network> => {
  return network === "mainnet"
    ? stakerMainnetConfig
    : network === "gnosis"
    ? stakerGnosisConfig
    : stakerPraterConfig;
};

export const getDefaultExecClient = (
  network: Network
): string => {
  return network === "mainnet"
    ? "geth.dnp.dappnode.eth"
    : network === "gnosis"
    ? "nethermind-xdai.dnp.dappnode.eth"
    : "goerli-besu.dnp.dappnode.eth";
}

const stakerMainnetConfig: StakerConfigSet<"mainnet"> = {
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
    useCheckpointSync: true,
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
    relays: [
      "https://0xa7ab7a996c8584251c8f925da3170bdfd6ebc75d50f5ddc4050a6fdc77f2a3b5fce2cc750d0865e05d7228af97d69561@agnostic-relay.net",
      "https://0xa1559ace749633b997cb3fdacffb890aeebdb0f5a3b6aaa7eeeaf1a38af0a8fe88b9e4b1f61f236d2e64d95733327a62@relay.ultrasound.money",
      "https://0xac6e77dfe25ecd6110b8e780608cce0dab71fdd5ebea22a16c0205200f2f8e2e3ad3b71d3499c54ad14d6c21b41a37ae@boost-relay.flashbots.net",
      "https://0x8b5d2e73e2a3a55c6c87b8b6eb92e0149a125c852751db1422fa951e42a09b82c142c3ea98d0d9930b056a3bc9896b8f@bloxroute.max-profit.blxrbdn.com",
      "https://0xad0a8bb54565c2211cee576363f3a347089d2f07cf72679d16911d740262694cadb62d7fd7483f27afd714ca0f1b9118@bloxroute.ethical.blxrbdn.com",
      "https://0xb0b07cd0abef743db4260b0ed50619cf6ad4d82064cb4fbec9d3ec530f7c5e6793d9f286c4e082c0244ffb9f2658fe88@bloxroute.regulated.blxrbdn.com",
      "https://0x9000009807ed12c1f08bf4e81c6da3ba8e3fc3d953898ce0102433094e5f22f21102ec057841fcb81978ed1ea0fa8246@builder-relay-mainnet.blocknative.com",
      "https://0xb3ee7afcf27f1f1259ac1787876318c6584ee353097a50ed84f51a1f21a323b3736f271a895c7ce918c038e4265918be@relay.edennetwork.io",
      "https://0x84e78cb2ad883861c9eeeb7d1b22a8e02332637448f84144e245d20dff1eb97d7abdde96d4e7f80934e5554e11915c56@relayooor.wtf"
    ]
  }
};

const stakerPraterConfig: StakerConfigSet<"prater"> = {
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
    useCheckpointSync: true,
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
    relays: [
      "https://0xafa4c6985aa049fb79dd37010438cfebeb0f2bd42b115b89dd678dab0670c1de38da0c4e9138c9290a398ecd9a0b3110@builder-relay-goerli.flashbots.net",
      "https://0x821f2a65afb70e7f2e820a925a9b4c80a159620582c1766b1b09729fec178b11ea22abb3a51f07b288be815a1a2ff516@bloxroute.max-profit.builder.goerli.blxrbdn.com",
      "https://0x8f7b17a74569b7a57e9bdafd2e159380759f5dc3ccbd4bf600414147e8c4e1dc6ebada83c0139ac15850eb6c975e82d0@builder-relay-goerli.blocknative.com",
      "https://0xb1d229d9c21298a87846c7022ebeef277dfc321fe674fa45312e20b5b6c400bfde9383f801848d7837ed5fc449083a12@relay-goerli.edennetwork.io",
      "https://0x8a72a5ec3e2909fff931c8b42c9e0e6c6e660ac48a98016777fc63a73316b3ffb5c622495106277f8dbcc17a06e92ca3@goerli-relay.securerpc.com/"
    ]
  }
};

const stakerGnosisConfig: StakerConfigSet<"gnosis"> = {
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
    useCheckpointSync: true,
    status: "ok",
    avatarUrl: "",
    isInstalled: true,
    isRunning: true,
    isSelected: true,
    isUpdated: true
  },
  enableWeb3signer: true
};

const corePackages = [
  "dappmanager.dnp.dappnode.eth",
  "ipfs.dnp.dappnode.eth",
  "vpn.dnp.dappnode.eth",
  "bind.dnp.dappnode.eth",
  "core.dnp.dappnode.eth",
  "https.dnp.dappnode.eth",
  "wifi.dnp.dappnode.eth",
  "wireguard.dnp.dappnode.eth"
];

export const nonStakerPackagesSetup = [
  "dms.dnp.dappnode.eth",
  "dappnode-exporter.dnp.dappnode.eth"
];

const stakerPkgsToKeep = (network: Network): string[] => {
  return network === "mainnet"
    ? [
        "geth.dnp.dappnode.eth",
        "prysm.dnp.dappnode.eth",
        "mev-boost.dnp.dappnode.eth",
        "web3signer.dnp.dappnode.eth"
      ]
    : network === "gnosis"
    ? [
        "nethermind-xdai.dnp.dappnode.eth",
        "teku-gnosis.dnp.dappnode.eth",
        "web3signer-gnosis.dnp.dappnode.eth"
      ]
    : [
        "goerli-besu.dnp.dappnode.eth",
        "lighthouse-prater.dnp.dappnode.eth",
        "mev-boost-goerli.dnp.dappnode.eth",
        "web3signer-prater.dnp.dappnode.eth"
      ];
};

export const packagesToKeep = (network: Network | undefined): string[] =>
  network
    ? [...corePackages, ...nonStakerPackagesSetup, ...stakerPkgsToKeep(network)]
    : [...corePackages, ...nonStakerPackagesSetup];
