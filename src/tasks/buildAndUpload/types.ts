import { PackageToBuildProps } from "../../types.js";
import { UploadTo } from "../../releaseUploader/index.js";

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
}
