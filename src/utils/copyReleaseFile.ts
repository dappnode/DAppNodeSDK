import fs from "fs";
import path from "path";
import { ReleaseFileConfig } from "../params";

export function copyReleaseFile(
  fileConfig: ReleaseFileConfig,
  fromDir: string,
  toDir: string
): void {
  const files = fs.readdirSync(fromDir);
  const matchingFiles = files.filter(file => fileConfig.regex.test(file));

  if (matchingFiles.length === 0) {
    if (fileConfig.required) {
      throw new NoFileFoundError(fileConfig, fromDir);
    } else {
      // Ignore
    }
  } else if (matchingFiles.length === 1) {
    fs.copyFileSync(
      path.join(fromDir, matchingFiles[0]),
      path.join(toDir, fileConfig.defaultName)
    );
  } else {
    if (fileConfig.multiple) {
      for (const matchingFile of matchingFiles) {
        fs.copyFileSync(
          path.join(fromDir, matchingFile),
          path.join(toDir, matchingFile)
        );
      }
    } else {
      throw new ToManyFilesError(fileConfig, fromDir, matchingFiles);
    }
  }
}

class NoFileFoundError extends Error {
  constructor(fileConfig: ReleaseFileConfig, fromDir: string) {
    super(
      `No ${fileConfig.id} found in ${fromDir}.` +
        `${fileConfig.id} naming must match ${fileConfig.regex.toString()}.` +
        `Please rename it to ${fileConfig.defaultName}`
    );
  }
}

class ToManyFilesError extends Error {
  constructor(
    fileConfig: ReleaseFileConfig,
    fromDir: string,
    matchingFiles: string[]
  ) {
    super(
      `More than one ${fileConfig.id} found in ${fromDir}: ` +
        matchingFiles.join(", ") +
        `Only one file can match ${fileConfig.regex.toString()}` +
        `Please rename it to ${fileConfig.defaultName}`
    );
  }
}
