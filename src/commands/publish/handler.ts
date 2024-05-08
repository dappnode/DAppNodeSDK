import Listr from "listr";
import {
  defaultComposeFileName,
  defaultDir,
  YargsError
} from "../../params.js";
import {
  ListrContextBuildAndPublish,
  ReleaseType,
  releaseTypes
} from "../../types.js";
import { VerbosityOptions } from "../build/types.js";
import { PublishCommandOptions } from "./types.js";
import { publish } from "../../tasks/publish/index.js";

const typesList = releaseTypes.join(" | ");

/**
 * Common handler for CLI and programatic usage
 */
export async function publishHandler({
  type,
  provider,
  eth_provider,
  content_provider,
  developer_address: developerAddress = process.env.DEVELOPER_ADDRESS,
  timeout: userTimeout,
  upload_to: uploadTo,
  github_release: githubRelease,
  dappnode_team_preset: dappnode_team_preset,
  require_git_data: requireGitData,
  delete_old_pins: deleteOldPins,
  // Global options
  dir = defaultDir,
  compose_file_name: composeFileName = defaultComposeFileName,
  silent,
  verbose
}: PublishCommandOptions): Promise<ListrContextBuildAndPublish> {
  let ethProvider = provider || eth_provider;
  let contentProvider = provider || content_provider;

  const isCi = process.env.CI;

  const verbosityOptions: VerbosityOptions = {
    renderer: verbose ? "verbose" : silent ? "silent" : "default"
  };

  /**
   * Specific set of options used for internal DAppNode releases.
   * Caution: options may change without notice.
   */
  if (dappnode_team_preset) {
    if (isCi) {
      contentProvider = "https://api.ipfs.dappnode.io";
      uploadTo = "ipfs";
      verbose = true;
    }
    ethProvider = "infura";
    githubRelease = true;
  }

  const releaseType = parseReleaseType({ type });

  const publishTasks = new Listr(
    publish({
      releaseType,
      ethProvider,
      dir,
      composeFileName,
      contentProvider,
      uploadTo,
      userTimeout,
      requireGitData,
      deleteOldPins,
      developerAddress,
      githubRelease,
      verbosityOptions
    }),
    verbosityOptions
  );

  return await publishTasks.run();
}

function parseReleaseType({ type }: { type?: string }): ReleaseType {
  const tag = process.env.TRAVIS_TAG || process.env.GITHUB_REF;
  const typeFromEnv = process.env.RELEASE_TYPE;

  /**
   * Custom options to pass the type argument
   */
  if (!type) {
    if (typeFromEnv) type = typeFromEnv;

    if (tag?.includes("release")) type = parseReleaseTypeFromTag(tag);
  }

  if (!type && typeFromEnv) {
    type = typeFromEnv as ReleaseType;
  }
  if (!type && tag?.includes("release")) {
    type = parseReleaseTypeFromTag(tag);
  }

  validateReleaseType(type);

  return type as ReleaseType;
}

function parseReleaseTypeFromTag(tag: string): ReleaseType {
  return (tag.split("release/")[1] || "patch") as ReleaseType;
}

/**
 * Make sure the release type exists and is correct
 */
function validateReleaseType(type?: string) {
  if (!type)
    throw new YargsError(`Missing required argument [type]: ${typesList}`);

  if (!releaseTypes.includes(type as ReleaseType))
    throw new YargsError(
      `Invalid release type "${type}", must be: ${typesList}`
    );
}
