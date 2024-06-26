import { UploadTo } from "../../releaseUploader/index.js";
import { CliGlobalOptions } from "../../types.js";

export interface PublishCommandOptions extends CliGlobalOptions {
  type?: string;
  provider?: string;
  eth_provider: string;
  content_provider: string;
  upload_to: UploadTo;
  developer_address?: string;
  timeout?: string;
  github_release?: boolean;
  dappnode_team_preset?: boolean;
  require_git_data?: boolean;
  delete_old_pins?: boolean;
  variants_dir_name?: string;
  variants?: string;
  all_variants?: boolean;
}
