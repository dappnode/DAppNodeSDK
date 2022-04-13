import { CliError } from "../../params";
import { Manifest } from "../../types";
import Ajv from "ajv";
import ajvErrors from "ajv-errors";
import manifestSchema from "./manifest.schema.json";
import { processError } from "../processError";

export function validateManifest(manifest: Manifest): void {
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
  console.log(valid);
  return {
    valid: Boolean(valid),
    errors: validate.errors
      ? validate.errors.map(e => processError(e, "manifest"))
      : []
  };
}
