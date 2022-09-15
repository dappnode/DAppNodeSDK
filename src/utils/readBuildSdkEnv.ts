import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { buildSdkEnvFileName } from "../params";

enum EnvsKeysAllowed {
  upstreamRepo = "_BUILD_UPSTREAM_REPO",
  upstreamVersion = "_BUILD_UPSTREAM_VERSION"
}

type BuildSdkEnvs = {
  [key in EnvsKeysAllowed]: string;
};

/**
 * Reads and returns the build_sdk.env file parsed if it exists, if not it will not throw an error
 */
export function readBuildSdkEnvFileNotThrow(dir: string): BuildSdkEnvs | null {
  try {
    const envFile = fs.readFileSync(
      path.join(dir, buildSdkEnvFileName),
      "utf8"
    );
    const envFileParsed = dotenv.parse(envFile);
    const envsKeys = Object.keys(envFileParsed);

    if (envsKeys.some(envKey => !(envKey in Object.values(EnvsKeysAllowed))))
      throw Error(`Env key is not allowed. Allowed envs keys are ${envsKeys}`);

    if (
      envFileParsed[EnvsKeysAllowed.upstreamRepo] in envFileParsed &&
      envFileParsed[EnvsKeysAllowed.upstreamVersion] in envFileParsed
    )
      return {
        [EnvsKeysAllowed.upstreamRepo]:
          envFileParsed[EnvsKeysAllowed.upstreamRepo],
        [EnvsKeysAllowed.upstreamVersion]:
          envFileParsed[EnvsKeysAllowed.upstreamVersion]
      };

    return null;
  } catch (e) {
    if (e.code === "ENOENT") {
      return null;
    }
    throw e;
  }
}
