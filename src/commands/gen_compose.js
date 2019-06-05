const { readManifest } = require("../utils/manifest");
const { generateAndWriteCompose } = require("../utils/compose");

exports.command = "gen_compose";

exports.describe = "Generate the docker-compose.yml from the manifest";

exports.handler = async ({ dir }) => {
  const manifest = readManifest({ dir });
  generateAndWriteCompose({ manifest, dir });
};
