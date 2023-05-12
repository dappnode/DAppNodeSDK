import { mapValues } from "lodash-es";
import { upstreamImageLabel } from "../../params.js";
import { Compose, getImageTag, getIsMonoService } from "@dappnode/types";

/**
 * Update service image tag to current version
 * @returns updated imageTags
 */
export function updateComposeImageTags(
  compose: Compose,
  { name: dnpName, version }: { name: string; version: string },
  options?: { editExternalImages?: boolean }
): Compose {
  return {
    ...compose,
    services: mapValues(compose.services, (service, serviceName) => {
      const newImageTag = getImageTag({
        dnpName,
        serviceName,
        version,
        isMonoService: getIsMonoService(compose)
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
