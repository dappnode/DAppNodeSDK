import { CliError } from "../../params.js";
import { VariantsMap } from "./types.js";

export function validateManifests(manifestMap: VariantsMap): void {
    for (const [, { manifest }] of Object.entries(manifestMap)) {
        const { name, version } = manifest;

        // Validate package name
        if (/[A-Z]/.test(name)) {
            throw new CliError("Package name in the manifest must be lowercase");
        }

        // Validate version format (semver)
        if (!/^\d+\.\d+\.\d+$/.test(version)) {
            throw new CliError("Version in the manifest must follow Semantic Versioning (SemVer) format (x.x.x)");
        }
    }
}
