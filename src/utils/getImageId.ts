import { shell } from "./shell";

/**
 * Returns the formated ID of a docker image
 *
 * @param imageTag i.e. admin.dnp.dappnode.eth:0.1.14
 * @param shell dependency
 * @return formated ID: sha256:0d31e5521ef6e92a0efb6110024da8a3517daac4b1e4bbbccaf063ce96641b1b
 */
export function getImageId(imageTag: string) {
  return shell(`docker inspect --format='{{json .Id}}' ${imageTag}`, {
    silent: true
  })
    .then(id => id.replace(/['"]+/g, ""))
    .catch(e => {
      console.warn(`WARNING: missing image: ${imageTag}. Error: ${e.message}`);
    });
}
