import { releaseFiles } from "@dappnode/types";
import { ManifestFormat } from "./files/manifest/types.js";

export * from "./files/compose/params.js";

export class CliError extends Error {}
export class YargsError extends Error {}

// Github Actions params

export const branchNameRoot = "dappnodebot/bump-upstream/";

// DAppNode params

export const defaultDir = "./";
export const defaultVariantsDirName = "package_variants";
// This is the default name of the environment variable that will be used to select each of the variants
export const defaultVariantsEnvName = "NETWORK";
export const defaultVariantsEnvValues = ["mainnet", "testnet"];
export const defaultManifestFileName = "dappnode_package.json";
export const defaultManifestFormat = ManifestFormat.json;
export const defaultComposeFileName = "docker-compose.yml";
export const tmpComposeFileName = "docker-compose-tmp.yml";
export const publishTxAppUrl = "https://dappnode.github.io/sdk-publish/";
export const UPSTREAM_VERSION_VARNAME = "UPSTREAM_VERSION";
export const upstreamImageLabel = "dappnode.dnp.upstreamImage";
export const PINATA_URL = "https://api.pinata.cloud";
// The build_sdk.env file is used by "slaves" DAppNode packages to define the UPSTREAM_PROJECT and UPSTREAM_VERSION used in the gha
export const buildSdkEnvFileName = "build_sdk.env";

export const releaseFilesDefaultNames: {
  [P in keyof typeof releaseFiles]: string;
} = Object.freeze({
  manifest: "dappnode_package.json",
  compose: "docker-compose.yml",
  avatar: "avatar.png",
  signature: "signature.json",
  setupWizard: "setup-wizard.json",
  setupSchema: "setup.schema.json",
  setupTarget: "setup-target.json",
  setupUiJson: "setup-ui.json",
  disclaimer: "disclaimer.md",
  gettingStarted: "getting-started.md",
  grafanaDashboards: "grafana-dashboard.json",
  prometheusTargets: "prometheus-targets.json"
} as const);
