import { CliError } from "../params";
import Ajv, { ErrorObject } from "ajv";
import ajvErrors from "ajv-errors";
// Schemas
import manifestSchema from "./schemas/manifest.schema.json";
import composeSchema from "./schemas/compose.schema.json";
import setupWizardSchema from "./schemas/setup-wizard.schema.json";
import yaml from "js-yaml";
import { Compose, Manifest } from "../files";

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  strictSchema: false,
  allowUnionTypes: true
});

ajvErrors(ajv);

/**
 * Validates manifest file with schema
 * @param manifest
 */
export function validateManifestSchema(manifest: Manifest): void {
  const validateManifest = ajv.compile(manifestSchema);
  const valid = validateManifest(manifest);
  if (!valid) {
    const errors = validateManifest.errors
      ? validateManifest.errors.map(e => processError(e, "manifest"))
      : [];
    throw new CliError(
      `Invalid manifest: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
    );
  }
}

/**
 * Validates compose file with schema
 * @param compose
 */
export function validateComposeSchema(compose: Compose): void {
  const validateCompose = ajv.compile(composeSchema);
  const valid = validateCompose(compose);
  if (!valid) {
    const errors = validateCompose.errors
      ? validateCompose.errors.map(e => processError(e, "compose"))
      : [];
    throw new CliError(
      `Invalid compose: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
    );
  }
}

/**
 * Validates setupWizard file with schema
 * @param setupWizard
 */
export function validateSetupWizardSchema(
  setupWizard: string | undefined
): void {
  // The setupwizard file is not mandatory and may not be present
  if (!setupWizard) return;
  const validateSetupWizard = ajv.compile(setupWizardSchema);
  const valid = validateSetupWizard(yaml.load(setupWizard));
  if (!valid) {
    const errors = validateSetupWizard.errors
      ? validateSetupWizard.errors.map(e => processError(e, "setupWizard"))
      : [];
    throw new CliError(
      `Invalid setupWizard: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
    );
  }
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
