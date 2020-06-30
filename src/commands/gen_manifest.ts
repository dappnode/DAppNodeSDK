import { writeManifest, manifestFromCompose } from "../utils/manifest";
import { readCompose } from "../utils/compose";
import { CliGlobalOptions } from "../types";

export const command = "gen_manifest";

export const describe = "Generate the manifest from the docker-compose.yml";

export const handler = async ({ dir }: CliGlobalOptions) => {
  const compose = readCompose(dir);
  const manifest = manifestFromCompose(compose);
  writeManifest(dir, manifest);
};
