import { CliError } from "../../params";
import { SetupWizard } from "../../types";
import Ajv from "ajv";
import ajvErrors from "ajv-errors";
import setupWizardSchema from "./setup-wizard.schema.json";
import { processError } from "../processError";

/**
 *
 * @param setupWizard
 * @returns
 */
export function validateSetupWizard(setupWizard: SetupWizard): void {
  const { valid, errors } = validateSetupWizardSchema(setupWizard);
  if (valid) return;

  // If not valid, print errors and stop execution

  throw new CliError(
    `Invalid wizard: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
  );
}

// ensure service names from wizard exists in compose
// ensure envs from wizard exists in compose
// Do not remove comments from wizard

/**
 * Validates a setupWizard syncronously. Does NOT throw.
 * @param setupWizard
 * @returns = {
 *   valid: false|true
 *   errors: [
 *     "setupWizard should have required property 'description'",
 *     "setupWizard.image.path should be an non-empty string",
 *   ]
 * }
 */
function validateSetupWizardSchema(
  setupWizard: SetupWizard
): { valid: boolean; errors: string[] } {
  // strictSchema: Prevent unknown keywords, formats etc
  const ajv = new Ajv({ allErrors: true, strictSchema: false });
  ajvErrors(ajv);
  // Precompile validator
  const validate = ajv.compile(setupWizardSchema);
  const valid = validate(setupWizard);
  return {
    valid: Boolean(valid),
    errors: validate.errors
      ? validate.errors.map(e => processError(e, "setupWizard"))
      : []
  };
}
