import { ManifestFormat } from "@dappnode/types";
import yaml from "js-yaml";
import prettier from "prettier";

/**
 * JSON.stringify + run prettier on the result
 */
export function stringifyJson<T>(json: T, format: ManifestFormat): string {
  switch (format) {
    case ManifestFormat.json:
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

    case ManifestFormat.yml:
    case ManifestFormat.yaml:
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
