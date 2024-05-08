import { Compose, Manifest } from "@dappnode/types";
import { writeCompose, updateComposeImageTags } from "../../files/index.js";
import { defaultComposeFileName } from "../../params.js";

/**
 * Temporary compose is written to the root directory
 * It is used to generate the docker images
 */
export function writeTmpCompose({
  compose,
  composeFileName = defaultComposeFileName,
  manifest,
  rootDir
}: {
  compose: Compose;
  composeFileName?: string;
  manifest: Manifest;
  rootDir: string;
}): void {
  const buildCompose = updateComposeImageTags(compose, manifest);
  writeCompose(buildCompose, { dir: rootDir, composeFileName });
}
