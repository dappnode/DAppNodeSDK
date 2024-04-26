import fs from "fs";
import rimraf from "rimraf";
import { Compose, Manifest, getImageTag } from "@dappnode/types";
import path from "path";

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

export function testPathExists(file: string): boolean {
  return fs.existsSync(path.join(testDir, file));
}

export function readTestFile(file: string): string {
  return fs.readFileSync(path.join(testDir, file), "utf8");
}
