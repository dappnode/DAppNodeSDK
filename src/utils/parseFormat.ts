import { AllowedFormats } from "../types";

export function parseFormat(filepath: string): AllowedFormats {
  if (/.json$/.test(filepath)) return AllowedFormats.json;
  if (/.yml$/.test(filepath)) return AllowedFormats.yml;
  if (/.yaml$/.test(filepath)) return AllowedFormats.yaml;
  throw Error(`Unsupported setup-wizard format: ${filepath}`);
}
