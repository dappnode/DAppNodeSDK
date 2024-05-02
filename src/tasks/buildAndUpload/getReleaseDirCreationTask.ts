import fs from "fs";
import path from "path";
import { ListrTask } from "listr/index.js";
import rimraf from "rimraf";
import { ListrContextBuildAndPublish } from "../../types.js";
import { getImageFileName } from "../../utils/getImageFileName.js";
import { VariantsMap } from "./types.js";

export function getReleaseDirCreationTask({ variantsMap }: { variantsMap: VariantsMap }): ListrTask<ListrContextBuildAndPublish> {

    return {
        title: `Create release directories`,
        task: () => createReleaseDirs({ variantsMap })
    };
}

function createReleaseDirs({ variantsMap }: { variantsMap: VariantsMap }): void {

    for (const [, { manifest, releaseDir, architectures }] of Object.entries(variantsMap)) {

        console.log(`Creating release directory for ${manifest.name} (version ${manifest.version}) at ${releaseDir}`);

        fs.mkdirSync(releaseDir, { recursive: true }); // Ok on existing dir
        const releaseFiles = fs.readdirSync(releaseDir);

        const imagePaths = architectures.map(arch => getImageFileName(manifest.name, manifest.version, arch));

        // Clean all files except the expected target images
        for (const filepath of releaseFiles)
            if (!imagePaths.includes(filepath))
                rimraf.sync(path.join(releaseDir, filepath));
    }
}