import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { releaseFiles } from "../params";
import { ReleaseFileType, SetupWizard } from "../types";
import { writeReleaseFile } from "../releaseFiles/writeReleaseFile";
import { readReleaseFile } from "../releaseFiles/readReleaseFile";

/**
 * Reads manifest and extra files in `buildDir` compacts them in the manifest
 * and writes the resulting manifest in `buildDir`
 * @param buildDir `build_0.1.0`
 */
export function compactManifestIfCore(buildDir: string): void {
  const manifest = readReleaseFile(ReleaseFileType.manifest, { dir: buildDir });

  if (manifest.releaseFile.type !== "dncore") return;

  const setupWizard = readSetupWizardIfExists(buildDir);
  if (setupWizard) {
    manifest.releaseFile.setupWizard = setupWizard;
  }

  writeReleaseFile(
    { type: ReleaseFileType.manifest, data: manifest.releaseFile },
    manifest.releaseFileFormat,
    {
      dir: buildDir
    }
  );
}

function readSetupWizardIfExists(buildDir: string): SetupWizard | null {
  const files = fs.readdirSync(buildDir);
  const setupWizardFile = files.find(file =>
    releaseFiles.setupWizard.regex.test(file)
  );
  if (!setupWizardFile) return null;
  const setupWizardPath = path.join(buildDir, setupWizardFile);
  return yaml.load(fs.readFileSync(setupWizardPath, "utf8"));
}
