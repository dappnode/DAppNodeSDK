import { Compose } from "./compose/types";
import { Manifest } from "./manifest/types";
import { SetupWizard } from "./setupWizard/types";

export interface ReleaseFilePaths {
  /** './folder', [optional] directory to load the compose from */
  dir?: string;
  /** 'manifest-admin.json', [optional] name of the compose file */
  releaseFileName?: string;
}

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

export enum ReleaseFileType {
  "manifest",
  "compose",
  "setupWizard"
}

export type ReleaseFile =
  | { type: ReleaseFileType.manifest; data: Manifest }
  | { type: ReleaseFileType.compose; data: Compose }
  | { type: ReleaseFileType.setupWizard; data: SetupWizard };
