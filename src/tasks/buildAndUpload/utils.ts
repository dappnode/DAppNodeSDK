import { Compose, Manifest } from "@dappnode/types";
import { writeCompose, updateComposeImageTags } from "../../files/index.js";
import { defaultComposeFileName } from "../../params.js";

export function writeBuildCompose({
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

export function writeReleaseCompose({
  compose,
  composeFileName = defaultComposeFileName,
  manifest,
  releaseDir
}: {
  compose: Compose;
  composeFileName?: string;
  manifest: Manifest;
  releaseDir: string;
}): void {
  const releaseCompose = updateComposeImageTags(compose, manifest, {
    editExternalImages: true
  });
  writeCompose(releaseCompose, { dir: releaseDir, composeFileName });
}
