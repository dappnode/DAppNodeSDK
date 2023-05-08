import { Compose } from "@dappnode/types";
import { getImageTag } from "../../params.js";
import { PackageImage } from "../../types.js";

/**
 * Get the package images and classify them in local and external
 */
export function getComposePackageImages(
  compose: Compose,
  { name: dnpName, version }: { name: string; version: string }
): PackageImage[] {
  return Object.entries(compose.services).map(
    ([serviceName, service]): PackageImage => {
      const imageTag = getImageTag({ dnpName, serviceName, version });
      return service.build
        ? { type: "local", imageTag }
        : { type: "external", imageTag, originalImageTag: service.image };
    }
  );
}
