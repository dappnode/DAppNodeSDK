import { VerbosityOptions } from "../../commands/build/types.js";
import { UploadTo } from "../../releaseUploader/index.js";
import { PackageToBuildProps, ReleaseType } from "../../types.js";

export interface PublishOptions {
  releaseType: ReleaseType;
  ethProvider: string;
  dir: string;
  composeFileName: string;
  contentProvider: string;
  uploadTo: UploadTo;
  userTimeout?: string;
  requireGitData?: boolean;
  deleteOldPins?: boolean;
  developerAddress?: string;
  githubRelease?: boolean;
  verbosityOptions: VerbosityOptions;
  variantsDirPath: string;
  packagesToBuildProps: PackageToBuildProps[];
}
