import { UploadTo } from "../../releaseUploader/index.js";
import { CliGlobalOptions } from "../../types.js";

export interface BuildCommandOptions extends CliGlobalOptions {
  provider: string;
  upload_to: UploadTo;
  timeout?: string;
  skip_save?: boolean;
  skip_upload?: boolean;
  sign_release?: boolean;
  require_git_data?: boolean;
  delete_old_pins?: boolean;
  variants_dir_name?: string;
  variants?: string;
  all_variants?: boolean;
}

export interface VerbosityOptions {
  renderer: "verbose" | "silent" | "default";
}
