import { CliError, releaseFilesDefaultNames } from "../../params";
import { Manifest } from "../../types";
import Ajv, { ErrorObject } from "ajv";
import ajvErrors from "ajv-errors";
import manifestSchema from "./manifest.schema.json";

export function validateManifest(manifest: Manifest): void {
  if (/[A-Z]/.test(manifest.name))
    throw new CliError("Package name in the manifest must be lowercase");

  // Make sure the release is of correct type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((manifest as any).image)
    throw new CliError(`
DAppNode packages expect all docker related data to be contained only
in the docker-compose.yml. Please translate the settings in 'manifest.image'
to your package's docker-compose.yml and then delete the 'manifest.image' prop.
`);
  if (manifest.avatar)
    throw new CliError(`
DAppNode packages expect the avatar to be located at the root folder as a file
and not declared in the manifest. Please add your package avatar to this directory
as ${releaseFilesDefaultNames.avatar} and then remove the 'manifest.avatar' property.
`);

  const { valid, errors } = validateManifestSchema(manifest);
  if (valid) return;

  // If not valid, print errors and stop execution

  throw new CliError(
    `Invalid manifest: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
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
function validateManifestSchema(
  manifest: Manifest
): { valid: boolean; errors: string[] } {
  const ajv = new Ajv({ allErrors: true, coerceTypes: true });
  ajvErrors(ajv);
  // Precompile validator
  const validate = ajv.compile(manifestSchema);
  const valid = validate(manifest);
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
 * "manifest.avatar should match pattern "^/(ipfs|bzz)/w+$""
 */
function processError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorObject: ErrorObject<string, Record<string, any>, unknown>
): string {
  const { schemaPath, message } = errorObject;
  const path = `manifest${schemaPath}`.replace(new RegExp("/", "g"), ".");
  return `${path} ${message}`;
}
