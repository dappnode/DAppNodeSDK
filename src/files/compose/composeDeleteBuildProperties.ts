import { readCompose } from "./readCompose.js";
import { ComposePaths } from "./types.js";
import { writeCompose } from "./writeCompose.js";

/**
 * Delete all `build` properties from all services in a disk persisted compose
 */
export function composeDeleteBuildProperties(paths?: ComposePaths): void {
  const compose = readCompose(paths);
  for (const service of Object.values(compose.services)) {
    delete service.build;
  }
  writeCompose(compose, paths);
}
