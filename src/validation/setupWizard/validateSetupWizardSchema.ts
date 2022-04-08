import Ajv from "ajv";
import ajvErrors from "ajv-errors";
import { SetupWizard } from "../../types";
import setupWizardSchema from "./setup-wizard.schema.json";

const ajv = new Ajv({ allErrors: true, jsonPointers: true });
ajvErrors(ajv);
// Precompile validator
const validate = ajv.compile(setupWizardSchema);

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
export function validateSetupWizardSchema(
  setupWizard: SetupWizard
): { valid: boolean; errors: string[] } {
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
function processError(errorObject: Ajv.ErrorObject): string {
  const { dataPath, message } = errorObject;
  const path = `manifest${dataPath}`.replace(new RegExp("/", "g"), ".");
  return `${path} ${message}`;
}
