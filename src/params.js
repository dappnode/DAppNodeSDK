class CliError extends Error {}
class YargsError extends Error {}

const releaseFilesRegex = {
  manifest: /dappnode_package.*\.json$/,
  image: /\.tar\.xz$/,
  compose: /compose.*\.yml$/,
  avatar: /avatar.*\.png$/,
  setupSchema: /setup\..*\.json$/,
  setupUiJson: /setup-ui\..*json$/,
  disclaimer: /disclaimer\.md$/i
};

const releaseFiles = {
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
  setupSchema: {
    required: false,
    regex: releaseFilesRegex.setupSchema,
    defaultName: "setup.schema.json",
    id: "setupSchema"
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
  }
};

module.exports = {
  CliError,
  YargsError,
  releaseFiles
};
