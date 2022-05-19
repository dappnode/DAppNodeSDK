// CLI types

import { Architecture } from "./releaseFiles/manifest/types";

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
