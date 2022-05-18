import Ajv, { ErrorObject } from "ajv";
import ajvErrors from "ajv-errors";
import manifestSchema from "../releaseFiles/manifest/manifest.schema.json";
import setupWizardSchema from "../releaseFiles/setupWizard/setup-wizard.schema.json";
import { CliError } from "../params";
import { ReleaseFile, ReleaseFileType } from "./types";

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
  const ajv = new Ajv({
    allErrors: true,
    coerceTypes: true,
    strictSchema: false
  });
  ajvErrors(ajv);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let schema: any;
  const releaseFileType = releaseFile.type;

  // Precompile validator
  switch (releaseFile.type) {
    case ReleaseFileType.manifest:
      schema = manifestSchema;
      break;
    case ReleaseFileType.compose:
      // To be implemented
      break;
    case ReleaseFileType.setupWizard:
      schema = setupWizardSchema;
      break;
    default:
      throw new Error(`Unknown release file type: ${releaseFileType}`);
  }
  const validate = ajv.compile(schema);
  const valid = validate(releaseFile.data);

  return {
    valid: Boolean(valid),
    errors: validate.errors
      ? validate.errors.map(e => processError(e, releaseFile.type))
      : []
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
 * "manifest.avatar should match pattern "^/(ipfs|bzz)/w+$""
 */
export function processError(
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
