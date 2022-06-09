import { CliError } from "../params";
import { ReleaseFileType } from "../types";
import Ajv, { ErrorObject } from "ajv";
import ajvErrors from "ajv-errors";
// Schemas
import manifestSchema from "./schemas/manifest.schema.json";
import composeSchema from "./schemas/compose.schema.json";
import setupWizardSchema from "./schemas/setup-wizard.schema.json";
import { SetupWizard } from "../releaseFiles/setupWizard/types";
import { Manifest } from "../releaseFiles/manifest/types";
import { Compose } from "../releaseFiles/compose/types";

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  strictSchema: false
});

ajvErrors(ajv);

console.log("Validating manifest schema");
const manifestValidate = ajv.compile(manifestSchema);
console.log("Validating setupwizard schema");
const setupWizardValidate = ajv.compile(setupWizardSchema);
console.log("Validating compose schema");
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
export function validateSchema(
  releaseFile: Manifest | Compose | SetupWizard
): void {
  const { valid, errors } = validateReleaseFile(releaseFile);
  if (valid) return;

  // If not valid, print errors and stop execution
  throw new CliError(
    `Invalid ${releaseFile}: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
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
export function validateReleaseFile(
  releaseFile: Manifest | Compose | SetupWizard
): { valid: boolean; errors: string[] } {
  const releaseFileType = inferReleaseFileType(releaseFile);
  switch (releaseFileType) {
    case "manifest":
      return {
        valid: Boolean(manifestValidate(releaseFile)),
        errors: manifestValidate.errors
          ? manifestValidate.errors.map(e => processError(e, releaseFileType))
          : []
      };
    case "compose":
      return {
        valid: Boolean(composeValidate(releaseFile)),
        errors: composeValidate.errors
          ? composeValidate.errors.map(e => processError(e, releaseFileType))
          : []
      };
    case "setupWizard":
      return {
        valid: Boolean(setupWizardValidate(releaseFile)),
        errors: setupWizardValidate.errors
          ? setupWizardValidate.errors.map(e =>
              processError(e, releaseFileType)
            )
          : []
      };
    default:
      throw new Error(`Unknown release file type: ${releaseFileType}`);
  }
}

function inferReleaseFileType(
  releaseFile: Manifest | Compose | SetupWizard
): ReleaseFileType {
  if ("name" in releaseFile) {
    return "manifest";
  } else if ("services" in releaseFile) {
    return "compose";
  } else if ("fields" in releaseFile) {
    return "setupWizard";
  } else throw Error("Unknown release file type");
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
  releaseFileType: ReleaseFileType
): string {
  const { schemaPath, message } = errorObject;
  const path = `${releaseFileType}${schemaPath}`.replace(
    new RegExp("/", "g"),
    "."
  );
  return `${path} ${message}`;
}
