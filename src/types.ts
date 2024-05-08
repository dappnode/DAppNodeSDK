// CLI types

export interface CliGlobalOptions {
  dir?: string;
  compose_file_name?: string;
  silent?: boolean;
  verbose?: boolean;
}

export interface ListrContextBuildAndPublish {
  [dnpName: string]: {
    releaseHash: string;
    releaseMultiHash: string;
    variant: string;
    nextVersion: string;
    txData: TxData;
  };
}

// Interal types

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

export const contentHashFile = "content-hash" as const;
