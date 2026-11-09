import { PackageToBuildProps } from "../../types.js";
import { UploadTo } from "../../releaseUploader/index.js";
import { SpecFinding } from "../../spec/rules.js";

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
  packagesToBuildProps: PackageToBuildProps[];
  skipComposeValidation?: boolean;
  stripComposeVersion?: boolean;
  /** Collects package spec violations found during validation. */
  specFindings?: SpecFinding[];
}
