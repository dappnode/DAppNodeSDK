import { AllowedFormats } from "../types";
import yaml from "js-yaml";
import prettier from "prettier";

/**
 * JSON.stringify + run prettier on the result
 */
export function stringifyJson<T>(json: T, format: AllowedFormats): string {
  switch (format) {
    case AllowedFormats.json:
      return prettier.format(JSON.stringify(json, null, 2), {
        // DAppNode prettier options, to match DAppNodeSDK + DAPPMANAGER
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        semi: true,
        singleQuote: false,
        trailingComma: "none",
        parser: "json"
      });

    case AllowedFormats.yml:
    case AllowedFormats.yaml:
      return prettier.format(yaml.dump(json, { indent: 2 }), {
        // DAppNode prettier options, to match DAppNodeSDK + DAPPMANAGER
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        semi: true,
        singleQuote: false,
        trailingComma: "none",
        // Built-in parser for YAML
        parser: "yaml"
      });
  }
}
