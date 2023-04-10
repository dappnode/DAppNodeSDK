import Ajv from "ajv";
import ajvErrors from "ajv-errors";

export const ajv = new Ajv({
  logger: false,
  allErrors: true,
  coerceTypes: true,
  strictSchema: false,
  allowUnionTypes: true
});

ajvErrors.default(ajv);
