import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { ListrTask } from "listr";
import { getFileHash } from "../utils/getFileHash";
import { loadCache, writeToCache, getCacheKey } from "../utils/cache";
import {
  Architecture,
  ListrContextBuildAndPublish,
  PackageImage,
  PackageImageExternal
} from "../types";
import { shell } from "../utils/shell";

/**
 * Save docker image
 * This step is extremely expensive computationally.
 * A local cache file will prevent unnecessary compressions if the image hasn't changed
 */
export function saveAndCompressImagesCached({
  images,
  architecture,
  destPath,
  buildTimeout,
  skipSave
}: {
  images: PackageImage[];
  architecture: Architecture;
  destPath: string;
  buildTimeout: number;
  skipSave?: boolean;
}): ListrTask<ListrContextBuildAndPublish>[] {
  const imageTags = images.map(image => image.imageTag);
  const externalImages = images.filter(
    (image): image is PackageImageExternal => image.type === "external"
  );

  return [
    {
      title: "Pull and tag external images",
      enabled: () => externalImages.length > 0,
      task: async (_, task) => {
        for (const { imageTag, originalImageTag } of externalImages) {
          await shell(
            `docker pull ${originalImageTag} --platform=${architecture}`,
            { onData: data => (task.output = data) }
          );
          task.output = `Tagging ${originalImageTag} > ${imageTag}`;
          await shell(`docker tag ${originalImageTag} ${imageTag}`);

          // Validate the resulting image architecture
          const imageDataRaw = await shell(`docker image inspect ${imageTag}`);
          const imageData = JSON.parse(imageDataRaw);
          const imageArch = `${imageData[0]["Os"]}/${imageData[0]["Architecture"]}`;
          if (imageArch !== architecture)
            throw Error(
              `pulled image ${originalImageTag} does not have the expected architecture '${architecture}', but ${imageArch}`
            );
        }
      }
    },
    {
      title: "Save and compress image",
      skip: () => skipSave,
      task: async (_, task) => {
        // Get a deterministic cache key for this collection of images
        const cacheKey = await getCacheKey(imageTags);

        // Load the cache object, and compute the target .tar.xz hash
        const cacheTarHash = loadCache().get(cacheKey);
        const tarHash = await getFileHash(destPath);
        if (tarHash && tarHash === cacheTarHash) {
          task.skip(`Using cached verified tarball ${destPath}`);
        } else {
          task.output = `Saving docker image to file...`;
          fs.mkdirSync(path.dirname(destPath), { recursive: true });

          await saveAndCompressImages({
            imageTags,
            destPath,
            timeout: buildTimeout,
            onData: msg => (task.output = msg)
          });

          task.output = `Storing saved image to cache...`;
          const newTarHash = await getFileHash(destPath);
          if (newTarHash) writeToCache({ key: cacheKey, value: newTarHash });
        }
      }
    }
  ];
}

async function saveAndCompressImages({
  imageTags,
  destPath,
  onData,
  timeout
}: {
  imageTags: string[];
  destPath: string;
  onData?: (data: string) => void;
  timeout?: number;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const dockerSave = spawn("docker", ["save", ...imageTags]);

    // -e9T0: Compression settings (extreme and paralelized)
    // -vv: Very verbose log to provide progress
    // -c: Outputs the compressed result to stdout
    // -f: Overwrite the destination path if necessary
    const xz = spawn("xz", ["-e9T0", "-vv", "-c", "-f"], { timeout });

    dockerSave.stdout.pipe(xz.stdin);

    let lastStderr = "";
    xz.stderr.on("data", chunk => {
      const data = chunk.toString().trim();
      lastStderr = data;
      if (onData) onData(data);
    });

    xz.stdout.pipe(fs.createWriteStream(destPath));

    // In order for xz to output update logs to stderr,
    // a SIGALRM must be sent to the xz process every interval
    // https://stackoverflow.com/questions/48452726/how-to-redirect-xzs-normal-stdout-when-do-tar-xz
    const interval = setInterval(() => xz.kill("SIGALRM"), 1000);

    xz.on("error", err => {
      clearInterval(interval);
      reject(Error(`Error compressing image: ${err.message} \n${lastStderr}`));
    });

    xz.on("exit", code => {
      clearInterval(interval);
      if (code) {
        reject(
          Error(`Error compressing image: xz exit ${code} \n${lastStderr}`)
        );
      } else {
        resolve();
      }
    });

    dockerSave.on("error", err => {
      clearInterval(interval);
      reject(Error(`Error saving image: ${err.message}`));
    });
  });
}
