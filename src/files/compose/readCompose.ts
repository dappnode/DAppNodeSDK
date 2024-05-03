import yaml from "js-yaml";
import { readFile } from "../../utils/file.js";
import { getComposePath } from "./getComposePath.js";
import { ComposePaths, Compose } from "@dappnode/types";
import { merge } from "lodash-es";

/**
 * Read a compose file and optionally merge it with a variant compose file.
 * @param paths The primary compose file paths.
 * @param variantPaths Optional variant compose file paths to merge with the primary compose.
 * @return The merged compose object.
 */
export function readCompose(paths?: ComposePaths[]): Compose {
  // Parse compose in try catch block to show a comprehensive error message
  try {

    if (!paths)
      return loadCompose(); // Load default compose

    const composes = paths.map((path) => loadCompose(path));

    return merge({}, ...composes);
  } catch (e) {
    throw Error(`Error parsing docker-compose: ${e.message}`);
  }
}

/**
 * Load a compose file
 * @returns compose object
 */
function loadCompose(paths?: ComposePaths): Compose {
  const composePath = getComposePath(paths);
  const data = readFile(composePath);
  const compose = yaml.load(data);

  if (!compose || typeof compose === "string") throw new Error(`Could not parse compose file: ${composePath}`);

  return compose;
}