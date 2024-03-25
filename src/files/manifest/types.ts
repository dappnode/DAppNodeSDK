import { Manifest } from "@dappnode/types";

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
}

export type VariantManifestMap = {
  [variant: string]: { manifest: Partial<Manifest>, format: ManifestFormat }
};
