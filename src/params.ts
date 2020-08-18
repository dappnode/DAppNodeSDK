export class CliError extends Error {}
export class YargsError extends Error {}

export const publishTxAppUrl = "https://dappnode.github.io/sdk-publish/";

export const cachePath = ".dappnodesdk-build-cache";

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
  image: /\.tar\.xz$/,
  compose: /compose.*\.yml$/,
  avatar: /avatar.*\.png$/,
  setupWizard: /setup-wizard\..*(json|yaml|yml)$/,
  setupSchema: /setup\..*\.json$/,
  setupTarget: /setup-target\..*json$/,
  setupUiJson: /setup-ui\..*json$/,
  disclaimer: /disclaimer\.md$/i,
  gettingStarted: /getting.*started\.md$/i
};

// Single arch images
export const imageArchAmd64 = (name: string, version: string): string =>
  `${name}_${version}.tar.xz`;
export const imageArchOther = (
  name: string,
  version: string,
  arch: string
): string => `${name}_${version}_${arch.replace(/\//g, "-")}.txz`;

export const releaseFiles = {
  manifest: {
    required: true,
    regex: releaseFilesRegex.manifest,
    defaultName: "dappnode_package.json",
    id: "manifest"
  },
  image: {
    required: true,
    regex: releaseFilesRegex.image,
    defaultName: "",
    id: "image"
  },
  compose: {
    required: true,
    regex: releaseFilesRegex.compose,
    defaultName: "docker-compose.yml",
    id: "compose"
  },
  avatar: {
    required: true,
    regex: releaseFilesRegex.avatar,
    defaultName: "avatar.png",
    id: "avatar"
  },
  setupWizard: {
    required: false,
    regex: releaseFilesRegex.setupWizard,
    defaultName: "setup-wizard.json",
    id: "setupWizard"
  },
  setupSchema: {
    required: false,
    regex: releaseFilesRegex.setupSchema,
    defaultName: "setup.schema.json",
    id: "setupSchema"
  },
  setupTarget: {
    required: false,
    regex: releaseFilesRegex.setupTarget,
    defaultName: "setup-target.json",
    id: "setupTarget"
  },
  setupUiJson: {
    required: false,
    regex: releaseFilesRegex.setupUiJson,
    defaultName: "setup-ui.json",
    id: "setupUiJson"
  },
  disclaimer: {
    required: false,
    regex: releaseFilesRegex.disclaimer,
    defaultName: "disclaimer.md",
    id: "disclaimer"
  },
  gettingStarted: {
    required: false,
    regex: releaseFilesRegex.gettingStarted,
    defaultName: "getting-started.md",
    id: "gettingStarted"
  }
};
