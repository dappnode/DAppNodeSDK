import { Architecture, Compose, Manifest } from "@dappnode/types";
import { ManifestFormat } from "./files/manifest/types.js";

export interface CliGlobalOptions {
  dir?: string;
  compose_file_name?: string;
  silent?: boolean;
  verbose?: boolean;
}

// TODO: Try to have all properties defined
interface ListrContextBuildItem {
  releaseDir?: string;
  releaseMultiHash?: string;
  variant?: string;
}

interface ListrContextPublishItem extends ListrContextBuildItem {
  nextVersion?: string;
  txData?: TxData;
}
export interface ListrContextBuild {
  [dnpName: string]: ListrContextBuildItem;
}

export interface ListrContextPublish {
  [dnpName: string]: ListrContextPublishItem;
}

interface PublishVariantsMapEntry {
  // Manifest-related
  manifest: Manifest;
  manifestFormat: ManifestFormat;
}

export interface BuildVariantsMapEntry extends PublishVariantsMapEntry {
  // Compose file
  compose: Compose;

  // File paths
  releaseDir: string;
  composePaths: string[];

  // Package information
  images: PackageImage[];
  architectures: Architecture[];
}

export interface BuildVariantsMap {
  [variant: string]: BuildVariantsMapEntry;
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
