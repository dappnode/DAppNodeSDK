import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { merge } from "lodash-es";
import { defaultDir } from "../../params.js";
import { readFile } from "../../utils/file.js";
import { SetupWizard, releaseFiles } from "@dappnode/types";
import { SetupWizardPaths } from "./types.js";

/**
 * Reads one or multiple setup-wizard YAML files and merges them. Returns null if none exist.
 * @param {SetupWizardPaths[]} paths - Optional array of directory/file specs.
 * @returns {SetupWizard | null}
 * @throws {Error} Throws if parsing fails or non-YAML format is encountered.
 */
export function readSetupWizardIfExists(
  paths?: SetupWizardPaths[]
): SetupWizard | null {
  try {
    // Determine list of file specs (default spec if no paths provided)
    const specs = paths && paths.length > 0 ? paths : [{}];

    // Resolve existing file paths
    const filePaths = specs
      .map(spec => {
        try {
          return findSetupWizardPath(spec);
        } catch {
          return undefined;
        }
      })
      .filter((p): p is string => typeof p === "string");

    if (filePaths.length === 0) return null;

    // Load and validate YAML-only files
    const wizards = filePaths.map(fp => {
      if (!/\.(yml|yaml)$/i.test(fp))
        throw new Error("Only YAML format supported for setup-wizard: " + fp);
      const data = readFile(fp);
      const parsed = yaml.load(data);
      if (!parsed || typeof parsed === "string")
        throw new Error(`Could not parse setup-wizard: ${fp}`);
      return parsed as SetupWizard;
    });

    // Merge all specs
    return merge({}, ...wizards);
  } catch (e) {
    throw new Error(`Error parsing setup-wizard: ${e.message}`);
  }
}

// Find a setup-wizard file, throws if not found
function findSetupWizardPath(spec?: SetupWizardPaths): string {
  const dirPath = spec?.dir || defaultDir;
  if (spec?.setupWizardFileName)
    return path.join(dirPath, spec.setupWizardFileName);
  const files: string[] = fs.readdirSync(dirPath);
  const match = files.find(f => releaseFiles.setupWizard.regex.test(f));
  if (!match)
    throw new Error(`No setup-wizard file found in directory ${dirPath}`);
  return path.join(dirPath, match);
}
