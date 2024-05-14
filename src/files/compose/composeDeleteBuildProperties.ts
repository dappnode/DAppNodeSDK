import { ComposePaths } from "@dappnode/types";
import { readCompose } from "./readCompose.js";
import { writeCompose } from "./writeCompose.js";

/**
 * Delete all `build` properties from all services in a disk persisted compose
 *
 * Remove `build` property AFTER building. Otherwise it may break ISO installations
 * https://github.com/dappnode/DAppNode_Installer/issues/161
 */
export function composeDeleteBuildProperties(paths?: ComposePaths): void {
  const compose = readCompose(paths ? [paths] : undefined);
  for (const service of Object.values(compose.services)) {
    delete service.build;
  }
  writeCompose(compose, paths);
}
