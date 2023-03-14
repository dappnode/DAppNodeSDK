import { getImageTag } from "../../params";
import { PackageImage } from "../../types";
import { getIsMonoService } from "../../utils/getIsMonoService";
import { Compose } from "./types";

/**
 * Get the package images and classify them in local and external
 */
export function getComposePackageImages(
  compose: Compose,
  { name: dnpName, version }: { name: string; version: string }
): PackageImage[] {
  const isMonoService = getIsMonoService(compose);
  return Object.entries(compose.services).map(
    ([serviceName, service]): PackageImage => {
      const imageTag = getImageTag({
        dnpName,
        serviceName,
        version,
        isMonoService
      });
      return service.build
        ? { type: "local", imageTag }
        : { type: "external", imageTag, originalImageTag: service.image };
    }
  );
}
