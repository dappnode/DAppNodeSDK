import fs from "fs";
import path from "path";
import { releaseFilesDefaultNames } from "../params";

interface FileConfig {
  regex: RegExp;
  maxSize: number;
  required: boolean;
  multiple: boolean;
  id: string;
}

function getDefaultName(fileId: string): string | undefined {
  return releaseFilesDefaultNames[
    fileId as keyof typeof releaseFilesDefaultNames
  ];
}

export function copyReleaseFile({
  fileConfig,
  fromDir,
  toDir
}: {
  fileConfig: FileConfig;
  fromDir: string;
  toDir: string;
}): void {
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
      path.join(toDir, getDefaultName(fileConfig.id) || matchingFiles[0])
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
      throw new TooManyFilesError(fileConfig, fromDir, matchingFiles);
    }
  }
}

class NoFileFoundError extends Error {
  constructor(fileConfig: FileConfig, fromDir: string) {
    super(
      `No ${fileConfig.id} found in ${fromDir}.` +
        `${fileConfig.id} naming must match ${fileConfig.regex.toString()}.` +
        `Please rename it to ${
          getDefaultName(fileConfig.id) || fileConfig.regex.toString()
        }`
    );
  }
}

class TooManyFilesError extends Error {
  constructor(
    fileConfig: FileConfig,
    fromDir: string,
    matchingFiles: string[]
  ) {
    super(
      `More than one ${fileConfig.id} found in ${fromDir}: ` +
        matchingFiles.join(", ") +
        `Only one file can match ${fileConfig.regex.toString()}` +
        `Please rename it to ${
          getDefaultName(fileConfig.id) || fileConfig.regex.toString()
        }`
    );
  }
}
