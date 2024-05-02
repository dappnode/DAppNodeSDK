import { Compose, Manifest } from "@dappnode/types";
import { writeCompose, updateComposeImageTags } from "../../files/index.js";

export function writeBuildCompose({
    compose,
    composeFileName,
    manifest,
    rootDir
}: {
    compose: Compose,
    composeFileName: string,
    manifest: Manifest,
    rootDir: string
}): void {

    const buildCompose = updateComposeImageTags(compose, manifest);
    writeCompose(buildCompose, { dir: rootDir, composeFileName });
}

export function writeReleaseCompose({
    compose,
    composeFileName,
    manifest,
    releaseDir
}: {
    compose: Compose,
    composeFileName: string,
    manifest: Manifest,
    releaseDir: string
}): void {

    const releaseCompose = updateComposeImageTags(compose, manifest, { editExternalImages: true });
    writeCompose(releaseCompose, { dir: releaseDir, composeFileName });
}   