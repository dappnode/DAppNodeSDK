import { CliGlobalOptions } from "../../../types.js";

export interface BuildActionOptions extends CliGlobalOptions {
    variants?: string;
    all_variants?: boolean;
}
