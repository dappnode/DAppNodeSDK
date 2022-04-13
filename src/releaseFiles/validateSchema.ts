import Ajv from "ajv";
import ajvErrors from "ajv-errors";
import manifestSchema from "../releaseFiles/manifest/manifest.schema.json";
import composeSchema from "../releaseFiles/compose/compose.schema.json";
import setupWizardSchema from "../releaseFiles/setupWizard.ts/setup-wizard.schema.json";
import { CliError } from "../params";
import { ReleaseFile, ReleaseFileType } from "./types";
import { processError } from "./renderAjvError";

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  strictSchema: false
});

ajvErrors(ajv);

const manifestValidate = ajv.compile(manifestSchema);
const composeValidate = ajv.compile(composeSchema);
const setupWizardValidate = ajv.compile(setupWizardSchema);

export function validateSchema(releaseFile: ReleaseFile): void {
  const { valid, errors } = validateReleaseFile(releaseFile);
  if (valid) return;

  // If not valid, print errors and stop execution
  throw new CliError(
    `Invalid ${releaseFile.type}: \n${errors
      .map(msg => `  - ${msg}`)
      .join("\n")}`
  );
}

/**
 * Validates a manifest syncronously. Does NOT throw.
 * @param manifest
 * @returns = {
 *   valid: false|true
 *   errors: [
 *     "manifest should have required property 'description'",
 *     "manifest.image.path should be an non-empty string",
 *   ]
 * }
 */
function validateReleaseFile(
  releaseFile: ReleaseFile
): { valid: boolean; errors: string[] } {
  const releaseFileType = releaseFile.type;

  // Compile
  switch (releaseFile.type) {
    case ReleaseFileType.manifest:
      return {
        valid: Boolean(manifestValidate(releaseFile.data)),
        errors: manifestValidate.errors
          ? manifestValidate.errors.map(e => processError(e, releaseFile.type))
          : []
      };
    case ReleaseFileType.compose:
      return {
        valid: Boolean(composeValidate(releaseFile.data)),
        errors: composeValidate.errors
          ? composeValidate.errors.map(e => processError(e, releaseFile.type))
          : []
      };
    case ReleaseFileType.setupWizard:
      return {
        valid: Boolean(setupWizardValidate(releaseFile.data)),
        errors: setupWizardValidate.errors
          ? setupWizardValidate.errors.map(e =>
              processError(e, releaseFile.type)
            )
          : []
      };
      break;
    default:
      throw new Error(`Unknown release file type: ${releaseFileType}`);
  }
}
