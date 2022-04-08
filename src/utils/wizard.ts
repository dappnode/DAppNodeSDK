import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import prettier from "prettier";
import { defaultDir, releaseFiles } from "../params";
import { SetupWizard, WizardFormat } from "../types";
import { readFile } from "./file";

function parseFormat(filepath: string): WizardFormat {
  if (/.json$/.test(filepath)) return WizardFormat.json;
  if (/.yml$/.test(filepath)) return WizardFormat.yml;
  if (/.yaml$/.test(filepath)) return WizardFormat.yaml;
  throw Error(`Unsupported setup-wizard format: ${filepath}`);
}

/**
 * Reads a setupWizard. Without arguments defaults to read the setupWizard at './setup-wizard.yml'
 */
export function readSetupWizardIfExists(): {
  setupWizard: SetupWizard;
  format: WizardFormat;
} | null {
  // Figure out the path and format
  const setupWizardPath = findSetupWizardPath();
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
  format: WizardFormat
): void {
  const setupWizardPath = getsetupWizardPath(format);
  fs.writeFileSync(setupWizardPath, stringifyJson(setupWizard, format));
}

/**
 * Get manifest path. Without arguments defaults to './setup-wizard.yml'
 * @return path = './setup-wizard.yml'
 */
export function findSetupWizardPath(): string | null {
  const dirPath = paths?.dir || defaultDir;

  const files = fs.readdirSync(dirPath);
  const filepath = files.find(file =>
    releaseFiles.setupWizard.regex.test(file)
  );
  if (!filepath) return null;
  return path.join(dirPath, filepath);
}

/**
 * Get setupWizard path. Without arguments defaults to './setup-wizard.yml'
 * @return path = './setup-wizard.yml'
 */
export function getsetupWizardPath(format: WizardFormat): string {
  return path.join(
    paths?.dir || defaultDir,
    paths?.setupWizardFileName || `setup-wizard.${format}`
  );
}

/**
 * JSON.stringify + run prettier on the result
 */
export function stringifyJson<T>(json: T, format: WizardFormat): string {
  switch (format) {
    case WizardFormat.json:
      return prettier.format(JSON.stringify(json, null, 2), {
        // DAppNode prettier options, to match DAppNodeSDK + DAPPMANAGER
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        semi: true,
        singleQuote: false,
        trailingComma: "none",
        parser: "json"
      });

    case WizardFormat.yml:
    case WizardFormat.yaml:
      return prettier.format(yaml.dump(json, { indent: 2 }), {
        // DAppNode prettier options, to match DAppNodeSDK + DAPPMANAGER
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        semi: true,
        singleQuote: false,
        trailingComma: "none",
        // Built-in parser for YAML
        parser: "yaml"
      });
  }
}
