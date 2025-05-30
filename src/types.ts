import {
  Architecture,
  Compose,
  ComposePaths,
  Manifest,
  NotificationsConfig,
  SetupWizard
} from "@dappnode/types";
import {
  ManifestPaths,
  ManifestFormat,
  NotificationsPaths,
  SetupWizardPaths
} from "./files/index.js";

export interface CliGlobalOptions {
  dir?: string;
  compose_file_name?: string;
  silent?: boolean;
  verbose?: boolean;
}

// TODO: Try to have all properties defined
interface ListrContextBuildItem {
  variant: string | null;
  releaseDir: string;
  releaseMultiHash?: string;
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

export interface PackageToBuildProps {
  // For packages not following multi-variant format, variant is null
  // These kind of packages have all their files in the root dir
  variant: string | null;

  // Manifest-related
  manifest: Manifest;
  manifestFormat: ManifestFormat;

  // Compose file
  compose: Compose;

  // Notifications
  notifications: NotificationsConfig | null;

  // Setup wizard
  setupWizard: SetupWizard | null;

  // File paths
  releaseDir: string;
  composePaths: ComposePaths[];
  manifestPaths: ManifestPaths[];
  notificationsPaths?: NotificationsPaths[];
  setupWizardPaths?: SetupWizardPaths[];

  // Package information
  images: PackageImage[];
  architectures: Architecture[];
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
