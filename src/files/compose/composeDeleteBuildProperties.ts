import { readCompose } from "./readCompose";
import { ComposePaths } from "./types";
import { writeCompose } from "./writeCompose";

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
