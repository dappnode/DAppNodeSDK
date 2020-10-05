import Docker from "dockerode";

let docker: Docker | null = null;

export function getDocker(): Docker {
  if (!docker) docker = new Docker({ socketPath: "/var/run/docker.sock" });
  return docker;
}

/**
 * Helper to get images by reference / repo / tag
 * @param _docker
 * @param imageRepo
 */
export async function getImageByTag(
  _docker: Docker,
  imageTag: string
): Promise<Docker.Image> {
  const images = await _docker.listImages();
  const matchingImages = images.filter(
    image => image.RepoTags && image.RepoTags.some(tag => tag === imageTag)
  );
  if (matchingImages.length > 1) {
    const imageTags = matchingImages.map(image => image.Labels[0]).join(", ");
    throw Error(`More than one image match for ${imageTag}: ${imageTags}`);
  } else if (matchingImages.length < 1) {
    throw Error(`No image found for ${imageTag}`);
  } else {
    console.log(matchingImages[0].Id);
    return _docker.getImage(matchingImages[0].Id);
  }
}
