import { CliError } from "../params";
import Ajv, { ErrorObject } from "ajv";
import ajvErrors from "ajv-errors";
// Schemas
import manifestSchema from "./schemas/manifest.schema.json";
import composeSchema from "./schemas/compose.schema.json";
import setupWizardSchema from "./schemas/setup-wizard.schema.json";
import { ReleaseFile } from "./types";
import yaml from "js-yaml";

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  strictSchema: false
});

ajvErrors(ajv);

const manifestValidate = ajv.compile(manifestSchema);
const setupWizardValidate = ajv.compile(setupWizardSchema);
const composeValidate = ajv.compile(composeSchema); // compose schema https://raw.githubusercontent.com/compose-spec/compose-spec/master/schema/compose-spec.json

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
export function validateSchema(releaseFile: ReleaseFile): void {
  let valid: boolean;
  let errors: string[];

  switch (releaseFile.type) {
    case "manifest":
      valid = Boolean(manifestValidate(releaseFile.data));
      errors = manifestValidate.errors
        ? manifestValidate.errors.map(e => processError(e, releaseFile.type))
        : [];
      break;

    case "compose":
      valid = Boolean(composeValidate(releaseFile.data));
      errors = composeValidate.errors
        ? composeValidate.errors.map(e => processError(e, releaseFile.type))
        : [];
      break;

    case "setupWizard":
      // setup-wizard is not a mandatory file, it may be undefined
      if (!releaseFile.data) return;
      valid = Boolean(setupWizardValidate(yaml.load(releaseFile.data)));
      errors = setupWizardValidate.errors
        ? setupWizardValidate.errors.map(e => processError(e, releaseFile.type))
        : [];
      break;
    default:
      throw new Error(`Unknown release file type`);
  }

  if (valid) return;

  // If not valid, print errors and stop execution
  throw new CliError(
    `Invalid ${releaseFile}: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
  );
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
 * "manifest.avatar should match pattern "^/(ipfs|bzz)/w+$""
 */
function processError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorObject: ErrorObject<string, Record<string, any>, unknown>,
  releaseFileType: "compose" | "manifest" | "setupWizard"
): string {
  const { schemaPath, message } = errorObject;
  const path = `${releaseFileType}${schemaPath}`.replace(
    new RegExp("/", "g"),
    "."
  );
  return `${path} ${message}`;
}
