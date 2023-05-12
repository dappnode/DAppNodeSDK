import { ManifestFormat } from "@dappnode/types";

export * from "./files/compose/params.js";

export class CliError extends Error {}
export class YargsError extends Error {}

// Github Actions params

export const branchNameRoot = "dappnodebot/bump-upstream/";

// DAppNode params

export const defaultDir = "./";
export const defaultManifestFileName = "dappnode_package.json";
export const defaultManifestFormat = ManifestFormat.json;
export const defaultComposeFileName = "docker-compose.yml";
export const publishTxAppUrl = "https://dappnode.github.io/sdk-publish/";
export const UPSTREAM_VERSION_VARNAME = "UPSTREAM_VERSION";
export const upstreamImageLabel = "dappnode.dnp.upstreamImage";
export const PINATA_URL = "https://api.pinata.cloud";
// The build_sdk.env file is used by "slaves" DAppNode packages to define the UPSTREAM_PROJECT and UPSTREAM_VERSION used in the gha
export const buildSdkEnvFileName = "build_sdk.env";
