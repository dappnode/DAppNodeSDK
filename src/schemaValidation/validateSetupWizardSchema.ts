import { ajv } from "./ajv.js";
import { readSetupWizardIfExists } from "../files";
import { CliError } from "../params";
import { processError } from "./utils";
import setupWizardSchema from "./schemas/setup-wizard.schema.json" assert { type: "json" };

/**
 * Validates setupWizard file with schema
 * @param setupWizard
 */
export function validateSetupWizardSchema(dir?: string): void {
  // The setupwizard file is not mandatory and may not be present
  const setupWizard = readSetupWizardIfExists(dir);
  if (!setupWizard) return;
  const validateSetupWizard = ajv.compile(setupWizardSchema);
  const valid = validateSetupWizard(setupWizard);
  if (!valid) {
    const errors = validateSetupWizard.errors
      ? validateSetupWizard.errors.map(e => processError(e, "setupWizard"))
      : [];
    throw new CliError(
      `Invalid setupWizard: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
    );
  }
}
