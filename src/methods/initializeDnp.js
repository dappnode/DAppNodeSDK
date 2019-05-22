const fs = require("fs");
const SEMVER = require("semver");
const inquirer = require("inquirer");
const { writeManifest } = require("../utils/manifest");
const { generateAndWriteCompose } = require("../utils/compose");
const shell = require("../utils/shell");

async function initializeDnp({ dir = "./", useDefaults }) {
  // shell outputs tend to include trailing spaces and new lines
  const defaultName = await shell('echo "${PWD##*/}"', { silent: true });
  const defaultAuthor = await shell("whoami", { silent: true });

  const defaultAnswers = {
    name: defaultName,
    version: "0.0.1",
    description: `${defaultName} description`,
    avatar: "",
    type: "service",
    author: defaultAuthor
  };

  if (!useDefaults) {
    console.log(`This utility will walk you through creating a dappnode_package.json file.
It only covers the most common items, and tries to guess sensible defaults.
`);
  }

  const answers = useDefaults
    ? defaultAnswers
    : await inquirer.prompt([
        {
          type: "input",
          name: "name",
          default: defaultAnswers.name,
          message: "DAppNodePackage name"
        },
        {
          type: "input",
          name: "version",
          default: defaultAnswers.version,
          message: "Version",
          validate: val =>
            !SEMVER.valid(val) ||
            !(
              SEMVER.eq(val, "1.0.0") ||
              SEMVER.eq(val, "0.1.0") ||
              SEMVER.eq(val, "0.0.1")
            )
              ? "the version needs to be a semver valid. The valid initial valid versions are 1.0.0, 0.1.0 or 0.0.1 "
              : true
        },
        {
          type: "input",
          name: "description",
          message: "Description",
          default: defaultAnswers.description
        },
        {
          type: "input",
          message: "Avatar",
          name: "avatar",
          default: defaultAnswers.avatar,
          validate: val =>
            !fs.existsSync(val) && val != ""
              ? "the avatar must be an png or jpg in the local path. You can leave this field empty"
              : true
        },
        {
          type: "list",
          name: "type",
          message: "Type",
          default: defaultAnswers.type,
          choices: ["service", "library", "dncore"]
        },
        {
          type: "input",
          message: "Author",
          name: "author",
          default: defaultAnswers.author
        },
        {
          type: "input",
          message:
            "Ports to expose externally (eg: 31313:30303;31313:30303/udp )",
          name: "ports"
        },
        {
          type: "input",
          message:
            "Volumes to be persistent (eg: ipfsdnpdappnodeeth_export:/export;/home/ipfs_data:/data/ipfs)",
          name: "volumes"
        },

        {
          type: "input",
          message:
            'Keywords (tags) separated by semicolons (eg: "DAppNodeCore;IPFS" )',
          name: "keywords"
        }
      ]);

  // Construct DNP
  const manifest = {
    name: (answers.name || "").toLowerCase() + ".public.dappnode.eth",
    version: answers.version,
    description: answers.description,
    avatar: answers.avatar,
    type: answers.type,
    image: {
      path: "",
      hash: "",
      size: "",
      restart: "always"
    },
    author: answers.author,
    license: "",
    dependencies: {}
  };

  // Append objects
  if (answers.volumes) manifest.image.volumes = answers.volumes.split(";");
  if (answers.ports) manifest.image.ports = answers.ports.split(";");
  if (answers.keywords) manifest.image.keywords = answers.keywords.split(";");

  // Create folders
  const path = dir;
  await shell(`mkdir -p ${path}`, { silent: true });
  await shell(`mkdir -p ${path}/build`, { silent: true });

  // Write manifest and compose
  writeManifest({ manifest, dir: path });
  generateAndWriteCompose({ manifest, dir: path });

  // Initialize Dockerfile
  fs.writeFileSync(
    `${path}/build/Dockerfile`,
    `FROM alpine

WORKDIR /usr/src/app

CMD [ "echo", "happy buidl" ]
`
  );
}

module.exports = initializeDnp;
