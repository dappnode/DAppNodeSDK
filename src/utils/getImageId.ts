import { shell } from "./shell";

/**
 * Returns the formated ID of a docker image
 *
 * @param imageTag i.e. admin.dnp.dappnode.eth:0.1.14
 * @param shell dependency
 * @return formated ID: sha256:0d31e5521ef6e92a0efb6110024da8a3517daac4b1e4bbbccaf063ce96641b1b
 */
export async function getImageId(imageTag: string): Promise<string> {
  const id = await shell(`docker inspect --format='{{json .Id}}' ${imageTag}`);
  return id.replace(/['"]+/g, "");
}

/**
 * Returns current image IDs in the docker cache
 * @returns [
 *   "6b74b6ba423e,
 *   "4a67065ab84a",
 *   "d112c75f4189",
 *   "cd25b55c48fd",
 *   "5480cec82e92"
 * ]
 */
export async function getImageIds(): Promise<string[]> {
  const res = await shell(`docker images -q`);
  return res.trim().split(/\r?\n/);
}
