import { Architecture } from "./types";

export class CliError extends Error {}
export class YargsError extends Error {}

export const publishTxAppUrl = "https://dappnode.github.io/sdk-publish/";

export const UPSTREAM_VERSION_VARNAME = "UPSTREAM_VERSION";

export const upstreamImageLabel = "dappnode.dnp.upstreamImage";

/**
 * Plain text file with should contain the IPFS hash of the release
 * Necessary for the installer script to fetch the latest content hash
 * of the eth clients. The resulting hashes are used by the DAPPMANAGER
 * to install an eth client when the user does not want to use a remote node
 *
 * /ipfs/QmNqDvqAyy3pN3PvymB6chM7S1FgYyive8LosVKUuaDdfd
 */
export const contentHashFile = "content-hash";

const releaseFilesRegex = {
  manifest: /dappnode_package.*\.json$/,
  compose: /compose.*\.yml$/,
  avatar: /avatar.*\.png$/,
  setupWizard: /setup-wizard\..*(json|yaml|yml)$/,
  setupSchema: /setup\..*\.json$/,
  setupTarget: /setup-target\..*json$/,
  setupUiJson: /setup-ui\..*json$/,
  disclaimer: /disclaimer\.md$/i,
  gettingStarted: /getting.*started\.md$/i,
  grafanaDashboards: /.*grafana-dashboard.json$/,
  prometheusTargets: /.*prometheus-targets.(json|yaml|yml)$/
};

export interface ReleaseFileConfig {
  id: keyof typeof releaseFilesRegex;
  regex: RegExp;
  defaultName: string;
  required?: boolean;
  multiple?: boolean;
}

export const releaseFiles: {
  [P in keyof typeof releaseFilesRegex]: ReleaseFileConfig;
} = {
  manifest: {
    regex: releaseFilesRegex.manifest,
    defaultName: "dappnode_package.json",
    id: "manifest",
    required: true
  },
  compose: {
    regex: releaseFilesRegex.compose,
    defaultName: "docker-compose.yml",
    id: "compose",
    required: true
  },
  avatar: {
    regex: releaseFilesRegex.avatar,
    defaultName: "avatar.png",
    id: "avatar",
    required: true
  },
  setupWizard: {
    regex: releaseFilesRegex.setupWizard,
    defaultName: "setup-wizard.json",
    id: "setupWizard"
  },
  setupSchema: {
    regex: releaseFilesRegex.setupSchema,
    defaultName: "setup.schema.json",
    id: "setupSchema"
  },
  setupTarget: {
    regex: releaseFilesRegex.setupTarget,
    defaultName: "setup-target.json",
    id: "setupTarget"
  },
  setupUiJson: {
    regex: releaseFilesRegex.setupUiJson,
    defaultName: "setup-ui.json",
    id: "setupUiJson"
  },
  disclaimer: {
    regex: releaseFilesRegex.disclaimer,
    defaultName: "disclaimer.md",
    id: "disclaimer"
  },
  gettingStarted: {
    regex: releaseFilesRegex.gettingStarted,
    defaultName: "getting-started.md",
    id: "gettingStarted"
  },
  grafanaDashboards: {
    regex: releaseFilesRegex.grafanaDashboards,
    defaultName: "grafana-dashboard.json",
    id: "grafanaDashboards",
    multiple: true
  },
  prometheusTargets: {
    regex: releaseFilesRegex.prometheusTargets,
    defaultName: "prometheus-targets.json",
    id: "prometheusTargets",
    multiple: true
  }
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
