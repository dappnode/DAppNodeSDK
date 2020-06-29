export interface TxData {
  to: string;
  value: string;
  data: string;
  gasLimit: string;
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
  thisIsAManifest: boolean;
}

export interface Compose {
  thisIsACompose: boolean;
}
