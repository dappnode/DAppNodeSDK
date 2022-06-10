import { uniqBy } from "lodash";
import { UPSTREAM_VERSION_VARNAME } from "../../params";
import { toTitleCase } from "../../utils/format";
import { Compose } from "./types";

/**
 * Get the compose upstream verion if available
 */
export function parseComposeUpstreamVersion(
  compose: Compose
): string | undefined {
  let upstreamVersions: { name: string; version: string }[] = [];
  for (const service of Object.values(compose.services))
    if (
      typeof service.build === "object" &&
      typeof service.build.args === "object"
    ) {
      for (const [varName, version] of Object.entries(service.build.args)) {
        if (varName.startsWith(UPSTREAM_VERSION_VARNAME)) {
          const name = varName
            .replace(UPSTREAM_VERSION_VARNAME, "")
            .replace(/^[^a-zA-Z\d]+/, "")
            .replace(/[^a-zA-Z\d]+$/, "");
          upstreamVersions.push({ name: toTitleCase(name), version });
        }
      }
    }

  // Remove duplicated build ARGs (for multi-service)
  upstreamVersions = uniqBy(upstreamVersions, item => item.name);

  return upstreamVersions.length === 0
    ? undefined
    : upstreamVersions.length === 1
    ? upstreamVersions[0].version
    : upstreamVersions
        .map(({ name, version }) => (name ? `${name}: ${version}` : version))
        .join(", ");
}
