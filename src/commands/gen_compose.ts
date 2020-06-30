import { readManifest } from "../utils/manifest";
import { generateAndWriteCompose } from "../utils/compose";
import { CliGlobalOptions } from "../types";

export const command = "gen_compose";

export const describe = "Generate the docker-compose.yml from the manifest";

export const handler = async ({ dir }: CliGlobalOptions) => {
  const manifest = readManifest(dir);
  generateAndWriteCompose(dir, manifest);
};
