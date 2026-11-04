import { CliGlobalOptions } from "../../../types.js";

export interface BuildActionOptions extends CliGlobalOptions {
  variants?: string;
  variants_dir_name?: string;
  all_variants?: boolean;
}
