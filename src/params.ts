import { Architecture, FileFormat, ManifestFormat } from "./types";

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

/**
 * Plain text file with should contain the IPFS hash of the release
 * Necessary for the installer script to fetch the latest content hash
 * of the eth clients. The resulting hashes are used by the DAPPMANAGER
 * to install an eth client when the user does not want to use a remote node
 *
 * /ipfs/QmNqDvqAyy3pN3PvymB6chM7S1FgYyive8LosVKUuaDdfd
 */
export const contentHashFile = "content-hash";

export const releaseFiles = {
  manifest: {
    regex: /dappnode_package.*\.(json|yaml|yml)$/,
    format: FileFormat.YAML,
    maxSize: 100e3, // Limit size to ~100KB
    required: true as const,
    multiple: false as const
  },
  compose: {
    regex: /compose.*\.yml$/,
    format: FileFormat.YAML,
    maxSize: 10e3, // Limit size to ~10KB
    required: true as const,
    multiple: false as const
  },
  avatar: {
    regex: /avatar.*\.png$/,
    format: null,
    maxSize: 100e3,
    required: true as const,
    multiple: false as const
  },
  setupWizard: {
    regex: /setup-wizard\..*(json|yaml|yml)$/,
    format: FileFormat.YAML,
    maxSize: 100e3,
    required: false as const,
    multiple: false as const
  },
  setupSchema: {
    regex: /setup\..*\.json$/,
    format: FileFormat.JSON,
    maxSize: 10e3,
    required: false as const,
    multiple: false as const
  },
  setupTarget: {
    regex: /setup-target\..*json$/,
    format: FileFormat.JSON,
    maxSize: 10e3,
    required: false as const,
    multiple: false as const
  },
  setupUiJson: {
    regex: /setup-ui\..*json$/,
    format: FileFormat.JSON,
    maxSize: 10e3,
    required: false as const,
    multiple: false as const
  },
  disclaimer: {
    regex: /disclaimer\.md$/i,
    format: FileFormat.TEXT,
    maxSize: 100e3,
    required: false as const,
    multiple: false as const
  },
  gettingStarted: {
    regex: /getting.*started\.md$/i,
    format: FileFormat.TEXT,
    maxSize: 100e3,
    required: false as const,
    multiple: false as const
  },
  prometheusTargets: {
    regex: /.*prometheus-targets.(json|yaml|yml)$/,
    format: FileFormat.YAML,
    maxSize: 10e3,
    required: false as const,
    multiple: false as const
  },
  grafanaDashboards: {
    regex: /.*grafana-dashboard.json$/,
    format: FileFormat.JSON,
    maxSize: 10e6, // ~ 10MB
    required: false as const,
    multiple: true as const
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
