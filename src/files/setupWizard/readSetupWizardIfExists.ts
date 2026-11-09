import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { mergeReplacingArrays } from "../../utils/merge.js";
import { defaultDir } from "../../params.js";
import { readFile } from "../../utils/file.js";
import { SetupWizard, releaseFiles } from "@dappnode/types";
import { SetupWizardPaths } from "./types.js";

/**
 * Reads one or multiple setup-wizard JSON or YAML files and merges them. Returns null if none exist.
 * @param {SetupWizardPaths[]} paths - Optional array of directory/file specs.
 * @returns {SetupWizard | null}
 * @throws {Error} Throws if parsing fails or unsupported format is encountered.
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

    // JSON is also valid YAML; preserve both supported source formats.
    const wizards = filePaths.map(fp => {
      if (!/\.(json|yml|yaml)$/i.test(fp))
        throw new Error("Expected JSON or YAML setup-wizard: " + fp);
      const data = readFile(fp);
      const parsed = yaml.load(data);
      if (!parsed || typeof parsed === "string")
        throw new Error(`Could not parse setup-wizard: ${fp}`);
      return parsed as SetupWizard;
    });

    // Merge all specs
    const fields = new Map<string, SetupWizard["fields"][number]>();
    for (const wizard of wizards) {
      if (wizard.fields !== undefined && !Array.isArray(wizard.fields))
        throw new Error("setup-wizard.fields must be an array");
      for (const field of wizard.fields || [])
        fields.set(field.id, mergeReplacingArrays(fields.get(field.id), field));
    }
    return {
      ...mergeReplacingArrays<SetupWizard>(...wizards),
      fields: [...fields.values()]
    };
  } catch (e) {
    throw new Error(`Error parsing setup-wizard: ${e.message}`, { cause: e });
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
