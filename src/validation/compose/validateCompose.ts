import { Compose } from "../../types";
import { CliError } from "../../params";
import Ajv from "ajv";
import ajvErrors from "ajv-errors";
import composeSchema from "./compose_schema.json";
import { processError } from "../processError";

// Original compose schema: https://raw.githubusercontent.com/compose-spec/compose-spec/master/schema/compose-spec.json
// Edited:
// - Change to draft7 due to errors
// - Use of schema HTTPS instead of HTTP
// - Change "id" to "$id"

export function validateCompose(compose: Compose): void {
  const { valid, errors } = validateComposeSchema(compose);
  if (valid) return;

  // If not valid, print errors and stop execution

  throw new CliError(
    `Invalid compose: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
  );
}

/**
 * Validates a compose syncronously. Does NOT throw.
 * @param compose
 * @returns = {
 *   valid: false|true
 *   errors: [
 *     "compose should have required property 'description'",
 *     "compose.image.path should be an non-empty string",
 *   ]
 * }
 */
function validateComposeSchema(
  compose: Compose
): { valid: boolean; errors: string[] } {
  // strictSchema: Prevent unknown keywords, formats etc
  const ajv = new Ajv({ allErrors: true, strictSchema: false });
  ajvErrors(ajv);
  // Precompile validator
  const validate = ajv.compile(composeSchema);
  const valid = validate(compose);
  return {
    valid: Boolean(valid),
    errors: validate.errors
      ? validate.errors.map(e => processError(e, "compose"))
      : []
  };
}
