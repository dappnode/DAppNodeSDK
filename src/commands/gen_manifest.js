const { writeManifest, manifestFromCompose } = require("../utils/manifest");
const { readCompose } = require("../utils/compose");

exports.command = "gen_manifest";

exports.describe = "Generate the manifest from the docker-compose.yml";

exports.handler = async ({ dir }) => {
  const compose = readCompose({ dir });
  const manifest = manifestFromCompose(compose);
  writeManifest({ manifest, dir });
};
