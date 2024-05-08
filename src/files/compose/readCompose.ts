import yaml from "js-yaml";
import { readFile } from "../../utils/file.js";
import { getComposePath } from "./getComposePath.js";
import { ComposePaths, Compose } from "@dappnode/types";
import { merge } from "lodash-es";

/**
 * Reads one or multiple Docker Compose YAML files. If multiple paths are provided, it merges
 * them into a single Compose object. This function is typically used to merge a primary Compose
 * file with one or more variant files that override or extend the primary configuration.
 * 
 * @param {ComposePaths[]} paths - Array of paths to the primary and optionally variant Compose files.
 *                                 If not provided, the function loads a default Compose configuration.
 * @return {Compose} The resulting Compose configuration object after merging all provided files.
 * @throws {Error} Throws an error if any of the Compose files cannot be read, parsed, or if the
 *                 result of parsing is not an object (e.g., if the parsed YAML is a plain string).
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