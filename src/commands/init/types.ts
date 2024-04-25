import { Manifest } from "@dappnode/types";
import { CliGlobalOptions } from "../../types.js";

export type TemplateAnswers = {
    variantsDir?: string;
    variants?: string[];
    envName?: string;
};

export type DefaultAnswers = Pick<Manifest, "name" | "version" | "description" | "avatar" | "type" | "author" | "license">;

export type UserAnswers = DefaultAnswers & TemplateAnswers;

export interface InitCommandOptions extends CliGlobalOptions {
    yes?: boolean;
    force?: boolean;
    use_variants?: boolean;
}