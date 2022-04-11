import { CliError } from "../../params";
import { SetupWizard } from "../../types";
import Ajv, { ErrorObject } from "ajv";
import ajvErrors from "ajv-errors";
import setupWizardSchema from "./setup-wizard.schema.json";

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
  const ajv = new Ajv({ allErrors: true });
  ajvErrors(ajv);
  // Precompile validator
  const validate = ajv.compile(setupWizardSchema);
  const valid = validate(setupWizard);
  return {
    valid: Boolean(valid),
    errors: validate.errors ? validate.errors.map(processError) : []
  };
}

// validate.errors = [
//   {
//     keyword: "pattern",
//     dataPath: "/avatar",
//     schemaPath: "#/properties/avatar/pattern",
//     params: { pattern: "^/(ipfs|bzz)/w+$" },
//     message: 'should match pattern "^/(ipfs|bzz)/w+$"'
//   },
//   {
//     keyword: "pattern",
//     dataPath: "/image/hash",
//     schemaPath: "#/properties/image/properties/hash/pattern",
//     params: { pattern: "^/(ipfs|bzz)/w+$" },
//     message: 'should match pattern "^/(ipfs|bzz)/w+$"'
//   },
//   {
//     keyword: "type",
//     dataPath: "/image/size",
//     schemaPath: "#/properties/image/properties/size/type",
//     params: { type: "number" },
//     message: "should be number"
//   },
//   {
//     keyword: "pattern",
//     dataPath: "/image/size",
//     schemaPath: "#/properties/image/properties/size/pattern",
//     params: { pattern: "^d+$" },
//     message: 'should match pattern "^d+$"'
//   },
//   {
//     keyword: "required",
//     dataPath: "",
//     schemaPath: "#/required",
//     params: { missingProperty: "license" },
//     message: "should have required property 'license'"
//   }
// ];

/**
 *
 * @param errorObject from AJV:
 * {
 *   keyword: "pattern",
 *   dataPath: "/avatar",
 *   schemaPath: "#/properties/avatar/pattern",
 *   params: { pattern: "^/(ipfs|bzz)/w+$" },
 *   message: 'should match pattern "^/(ipfs|bzz)/w+$"'
 * }
 * @returns errorMessage:
 * "manifest.setupWizard should match pattern "^/(ipfs|bzz)/w+$""
 */
function processError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorObject: ErrorObject<string, Record<string, any>, unknown>
): string {
  const { schemaPath, message } = errorObject;
  const path = `manifest${schemaPath}`.replace(new RegExp("/", "g"), ".");
  return `${path} ${message}`;
}
