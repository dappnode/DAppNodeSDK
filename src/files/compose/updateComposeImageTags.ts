import { mapValues } from "lodash";
import { getImageTag, upstreamImageLabel } from "../../params";
import { Compose } from "./types";
import { getIsMonoService } from "../../utils/getIsMonoService";

/**
 * Update service image tag to current version
 * @returns updated imageTags
 */
export function updateComposeImageTags(
  compose: Compose,
  { name: dnpName, version }: { name: string; version: string },
  options?: { editExternalImages?: boolean }
): Compose {
  const isMonoService = getIsMonoService(compose);
  return {
    ...compose,
    services: mapValues(compose.services, (service, serviceName) => {
      const newImageTag = getImageTag({
        dnpName,
        serviceName,
        version,
        isMonoService
      });
      return service.build
        ? {
            ...service,
            image: newImageTag
          }
        : options?.editExternalImages
        ? {
            ...service,
            image: newImageTag,
            labels: {
              ...(service.labels || {}),
              [upstreamImageLabel]: service.image
            }
          }
        : service;
    })
  };
}
