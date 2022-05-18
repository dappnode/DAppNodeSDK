import fs from "fs";
import rimraf from "rimraf";
import { getImageTag } from "../src/params";
import { Compose } from "../src/releaseFiles/compose/types";
import { Manifest } from "../src/releaseFiles/manifest/types";

export const testDir = "test_files";
export function cleanTestDir(): void {
  rimraf.sync(testDir);
  fs.mkdirSync(testDir, { recursive: true });
}

export function generateCompose(manifest: Manifest): Compose {
  const dnpName = manifest.name,
    serviceName = manifest.name,
    version = manifest.version;
  return {
    version: "3.4",
    services: {
      [serviceName]: {
        build: ".", // Dockerfile is in root dir
        image: getImageTag({ dnpName, serviceName, version }),
        restart: "unless-stopped"
      }
    }
  };
}
