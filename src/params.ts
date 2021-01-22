import { Architecture } from "./types";

export class CliError extends Error {}
export class YargsError extends Error {}

export const defaultDir = "./";
export const publishTxAppUrl = "https://dappnode.github.io/sdk-publish/";
export const UPSTREAM_VERSION_VARNAME = "UPSTREAM_VERSION";
export const upstreamImageLabel = "dappnode.dnp.upstreamImage";
export const PINATA_URL = "https://api.pinata.cloud";

/**
 * Plain text file with should contain the IPFS hash of the release
 * Necessary for the installer script to fetch the latest content hash
 * of the eth clients. The resulting hashes are used by the DAPPMANAGER
 * to install an eth client when the user does not want to use a remote node
 *
 * /ipfs/QmNqDvqAyy3pN3PvymB6chM7S1FgYyive8LosVKUuaDdfd
 */
export const contentHashFile = "content-hash";

// Declare true as true for conditional static types to work
const TRUE: true = true as const;
const FALSE: false = false as const;
const FORMAT = {
  JSON: "JSON" as const,
  YAML: "YAML" as const,
  TEXT: "TEXT" as const
};

export const releaseFiles = {
  manifest: {
    regex: /dappnode_package.*\.json$/,
    format: FORMAT.JSON,
    maxSize: 100e3, // Limit size to ~100KB
    required: TRUE,
    multiple: FALSE
  },
  compose: {
    regex: /compose.*\.yml$/,
    format: FORMAT.YAML,
    maxSize: 10e3, // Limit size to ~10KB
    required: TRUE,
    multiple: FALSE
  },
  avatar: {
    regex: /avatar.*\.png$/,
    format: null,
    maxSize: 100e3,
    required: TRUE,
    multiple: FALSE
  },
  setupWizard: {
    regex: /setup-wizard\..*(json|yaml|yml)$/,
    format: FORMAT.YAML,
    maxSize: 100e3,
    required: FALSE,
    multiple: FALSE
  },
  setupSchema: {
    regex: /setup\..*\.json$/,
    format: FORMAT.JSON,
    maxSize: 10e3,
    required: FALSE,
    multiple: FALSE
  },
  setupTarget: {
    regex: /setup-target\..*json$/,
    format: FORMAT.JSON,
    maxSize: 10e3,
    required: FALSE,
    multiple: FALSE
  },
  setupUiJson: {
    regex: /setup-ui\..*json$/,
    format: FORMAT.JSON,
    maxSize: 10e3,
    required: FALSE,
    multiple: FALSE
  },
  disclaimer: {
    regex: /disclaimer\.md$/i,
    format: FORMAT.TEXT,
    maxSize: 100e3,
    required: FALSE,
    multiple: FALSE
  },
  gettingStarted: {
    regex: /getting.*started\.md$/i,
    format: FORMAT.TEXT,
    maxSize: 100e3,
    required: FALSE,
    multiple: FALSE
  },
  prometheusTargets: {
    regex: /.*prometheus-targets.(json|yaml|yml)$/,
    format: FORMAT.YAML,
    maxSize: 10e3,
    required: FALSE,
    multiple: FALSE
  },
  grafanaDashboards: {
    regex: /.*grafana-dashboard.json$/,
    format: FORMAT.JSON,
    maxSize: 10e6, // ~ 10MB
    required: FALSE,
    multiple: TRUE
  }
};

export const releaseFilesDefaultNames: {
  [P in keyof typeof releaseFiles]: string;
} = {
  manifest: "dappnode_package.json",
  compose: "docker-compose.yml",
  avatar: "avatar.png",
  setupWizard: "setup-wizard.json",
  setupSchema: "setup.schema.json",
  setupTarget: "setup-target.json",
  setupUiJson: "setup-ui.json",
  disclaimer: "disclaimer.md",
  gettingStarted: "getting-started.md",
  grafanaDashboards: "grafana-dashboard.json",
  prometheusTargets: "prometheus-targets.json"
};

// Naming

// Single arch images
export const getArchTag = (arch: Architecture): string =>
  arch.replace(/\//g, "-");
export const getImagePath = (
  name: string,
  version: string,
  arch: Architecture
): string => `${name}_${version}_${getArchTag(arch)}.txz`;
export const getLegacyImagePath = (name: string, version: string): string =>
  `${name}_${version}.tar.xz`;

/**
 * Get a unique domain per container, considering multi-service packages
 */
export const getContainerDomain = ({
  dnpName,
  serviceName
}: {
  serviceName: string;
  dnpName: string;
}): string => {
  if (!serviceName || serviceName === dnpName) {
    return dnpName;
  } else {
    return [serviceName, dnpName].join(".");
  }
};

export const getImageTag = ({
  dnpName,
  serviceName,
  version
}: {
  dnpName: string;
  serviceName: string;
  version: string;
}): string => [getContainerDomain({ dnpName, serviceName }), version].join(":");
