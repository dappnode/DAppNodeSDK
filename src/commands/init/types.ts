import { Manifest } from "@dappnode/types";

export type TemplatePackageAnswers = {
    variantsDir: string;
    variants: string[];
    envName: string;
};

export type SinglePackageAnswers = Pick<Manifest, "name" | "version" | "description" | "avatar" | "type" | "author" | "license">;

export type UserAnswers = SinglePackageAnswers & Partial<TemplatePackageAnswers>;