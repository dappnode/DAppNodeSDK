import { CliError } from "../../params";
import { SetupWizard } from "../../types";
import { validateSetupWizardSchema } from "./validateSetupWizardSchema";

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
