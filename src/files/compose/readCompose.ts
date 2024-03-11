import yaml from "js-yaml";
import { readFile } from "../../utils/file.js";
import { getComposePath } from "./getComposePath.js";
import { ComposePaths, Compose } from "@dappnode/types";
import { merge } from "lodash-es";

/**
 * Read a compose parsed data
 * Without arguments defaults to write the manifest at './docker-compose.yml'
 * @return compose object
 */
export function readCompose(paths?: ComposePaths, variantPaths?: ComposePaths): Compose {
  // Parse compose in try catch block to show a comprehensive error message
  try {
    const compose = loadCompose(paths);

    if (!variantPaths) return compose;

    const variantCompose = loadCompose(variantPaths);

    return merge({}, compose, variantCompose);
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
  const compose = yaml.safeLoad(data);
  if (!compose) throw Error("result is undefined");
  if (typeof compose === "string") throw Error("result is a string");
  return compose as Compose;
}