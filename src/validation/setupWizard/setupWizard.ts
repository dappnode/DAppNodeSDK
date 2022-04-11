import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { defaultDir, releaseFiles } from "../../params";
import { AllowedFormats, SetupWizard } from "../../types";
import { readFile } from "../../utils/file";
import { stringifyJson } from "../../utils/stringifyJson";
import { parseFormat } from "../../utils/parseFormat";

interface SetupWizardPaths {
  /** './folder', [optional] directory to load the compose from */
  dir?: string;
  /** 'manifest-admin.json', [optional] name of the compose file */
  setupWizardFileName?: string;
}

/**
 * Reads a setupWizard. Without arguments defaults to read the setupWizard at './setup-wizard.yml'
 */
export function readSetupWizardIfExists(
  paths?: SetupWizardPaths
): {
  setupWizard: SetupWizard;
  format: AllowedFormats;
} | null {
  // Figure out the path and format
  const setupWizardPath = findSetupWizardPath(paths);
  if (!setupWizardPath) return null;
  const format = parseFormat(setupWizardPath);
  const data = readFile(setupWizardPath);

  // Parse setupWizard in try catch block to show a comprehensive error message
  try {
    return {
      format,
      setupWizard: yaml.load(data)
    };
  } catch (e) {
    throw Error(`Error parsing setupWizard: ${e.message}`);
  }
}

/**
 * Writes a setupWizard. Without arguments defaults to write the setupWizard at './setup-wizard.yml'
 */
export function writeSetupWizard(
  setupWizard: SetupWizard,
  format: AllowedFormats
): void {
  const setupWizardPath = getsetupWizardPath(format);
  fs.writeFileSync(setupWizardPath, stringifyJson(setupWizard, format));
}

/**
 * Get manifest path. Without arguments defaults to './setup-wizard.yml'
 * @return path = './setup-wizard.yml'
 */
function findSetupWizardPath(paths?: SetupWizardPaths): string | null {
  const dirPath = paths?.dir || defaultDir;
  if (paths?.setupWizardFileName) {
    return path.join(dirPath, paths.setupWizardFileName);
  } else {
    const files = fs.readdirSync(dirPath);
    const filepath = files.find(file =>
      releaseFiles.setupWizard.regex.test(file)
    );
    if (!filepath) return null;
    return path.join(dirPath, filepath);
  }
}

/**
 * Get setupWizard path. Without arguments defaults to './setup-wizard.yml'
 * @return path = './setup-wizard.yml'
 */
function getsetupWizardPath(format: AllowedFormats): string {
  return path.join(defaultDir, `setup-wizard.${format}`);
}
