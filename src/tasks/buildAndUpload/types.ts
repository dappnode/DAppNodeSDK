import { PackageImage } from "../../types.js";
import { UploadTo } from "../../releaseUploader/index.js";
import { Architecture, Compose, Manifest } from "@dappnode/types";
import { ManifestFormat } from "../../files/manifest/types.js";

export interface BuildAndUploadOptions {
  contentProvider: string;
  uploadTo: UploadTo;
  userTimeout?: string;
  skipSave?: boolean;
  skipUpload?: boolean;
  requireGitData?: boolean;
  deleteOldPins?: boolean;
  composeFileName: string;
  dir: string;
  variantsDirPath?: string;
  variantsMap: VariantsMap;
}

export interface VariantsMapEntry {
  // Manifest-related
  manifest: Manifest;
  manifestFormat: ManifestFormat;

  // Compose file
  compose: Compose;

  // File paths
  releaseDir: string;
  composePaths: string[];

  // Package information
  images: PackageImage[];
  architectures: Architecture[];
}

export interface VariantsMap {
  [variant: string]: VariantsMapEntry;
}
