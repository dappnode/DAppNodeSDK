export enum ManifestFormat {
  json = "json",
  yml = "yml",
  yaml = "yaml"
}

export interface ManifestPaths {
  /** './folder', [optional] directory to load the manifest from */
  dir?: string;
  /** 'manifest-admin.json', [optional] name of the manifest file */
  manifestFileName?: string;
  /** './folder', [optional] directory to load the package variants from */
  packageVariantsDir?: string;
  /** 'variantName', [optional] name of the package variant */
  variantName?: string;
}
