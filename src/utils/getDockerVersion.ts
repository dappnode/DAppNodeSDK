import semver from "semver";
import { shell } from "./shell";

/**
 * Returns parsed and validated semver of docker -v
 */
export async function getDockerVersion(): Promise<string | null> {
  const dockerVersion = await shell(`docker -v`).catch(e => {
    throw Error(`docker is not installed: ${e.message}`);
  });
  // dockerVersion = "Docker version 19.03.13-beta2, build ff3fbc9d55"
  const match = dockerVersion.match(/\d+\.\d+\.\d+/g);
  if (!match) return null;
  const regexVersion = match[0];
  if (!semver.valid(regexVersion)) return null;
  return regexVersion;
}
