import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { SetupWizard, releaseFiles } from "@dappnode/types";
import { readManifest } from "./readManifest.js";
import { writeManifest } from "./writeManifest.js";

/**
 * Reads manifest and extra files in `buildDir` compacts them in the manifest
 * and writes the resulting manifest in `buildDir`
 *
 * Add setup-wizard file to the manifest since packages distributed on install
 * only include their manifest and compose.
 * TODO: Track issue for a better solution https://github.com/dappnode/DNP_DAPPMANAGER/issues/570
 *
 * @param buildDir `build_0.1.0`
 */
export function compactManifestIfCore(buildDir: string): void {
    const { manifest, format } = readManifest([{ dir: buildDir }]);

    if (manifest.type !== "dncore") return;

    const setupWizard = readSetupWizardIfExists(buildDir);
    if (setupWizard) {
        manifest.setupWizard = setupWizard;
    }

    writeManifest(manifest, format, { dir: buildDir });
}

// Utils

function readSetupWizardIfExists(buildDir: string): SetupWizard | null {
    const files = fs.readdirSync(buildDir);
    const setupWizardFile = files.find(file =>
        releaseFiles.setupWizard.regex.test(file)
    );
    if (!setupWizardFile) return null;
    const setupWizardPath = path.join(buildDir, setupWizardFile);
    return yaml.load(fs.readFileSync(setupWizardPath, "utf8"));
}