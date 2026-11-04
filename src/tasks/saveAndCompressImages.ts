import fs from "fs";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { pipeline } from "stream/promises";
import { ListrTask } from "listr";
import { getFileHash } from "../utils/getFileHash.js";
import { loadCache, writeToCache, getCacheKey } from "../utils/cache.js";
import {
  ListrContextBuild,
  PackageImage,
  PackageImageExternal
} from "../types.js";
import { shell } from "../utils/shell.js";
import { Architecture } from "@dappnode/types";

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
}): ListrTask<ListrContextBuild>[] {
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
            ["docker", "pull", `--platform=${architecture}`, originalImageTag],
            { onData: data => (task.output = data) }
          );
          task.output = `Tagging ${originalImageTag} > ${imageTag}`;
          await shell(["docker", "tag", originalImageTag, imageTag]);

          // Validate the resulting image architecture
          const imageDataRaw = await inspectImageForPlatform(
            imageTag,
            architecture
          );
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

/**
 * With the containerd image store a tag can hold several platforms, and a plain
 * inspect reports the host platform (or none). `--platform` selects the pulled one.
 * Docker CLI < 28.1 lacks the flag; there a tag holds one platform, so a plain inspect is exact.
 */
export async function inspectImageForPlatform(
  imageTag: string,
  architecture: Architecture
): Promise<string> {
  try {
    return await shell([
      "docker",
      "image",
      "inspect",
      `--platform=${architecture}`,
      imageTag
    ]);
  } catch (e) {
    const output = `${e.message || ""}\n${e.stderr || ""}`;
    if (!/unknown flag: --platform/i.test(output)) throw e;
    return await shell(["docker", "image", "inspect", imageTag]);
  }
}

/** Export atomically only after both processes and both pipes have succeeded. */
export async function saveAndCompressImages({
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
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  const temporaryDir = await fs.promises.mkdtemp(
    path.join(path.dirname(destPath), ".dappnodesdk-")
  );
  const temporaryPath = path.join(temporaryDir, "image.txz");
  const dockerSave = spawn("docker", ["save", ...imageTags]);
  const xz = spawn("xz", ["-e9T0", "-vv", "-c"]);
  let dockerStderr = "";
  let compressionStderr = "";
  dockerSave.stderr.on("data", (chunk: Buffer) => {
    dockerStderr = (dockerStderr + chunk.toString()).slice(-65536);
  });
  xz.stderr.on("data", (chunk: Buffer) => {
    const message = chunk.toString().trim();
    compressionStderr = (compressionStderr + message).slice(-65536);
    if (message && onData) onData(message);
  });

  const completed = (
    child: ChildProcess,
    label: string,
    stderr: () => string
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => {
        if (code === 0 && !signal) resolve();
        else
          reject(
            new Error(
              `${label} failed (${signal || `exit ${code}`}): ${stderr()}`
            )
          );
      });
    });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((resolve, reject) => {
    if (timeout && timeout > 0)
      timer = setTimeout(
        () => reject(new Error(`Image export timed out after ${timeout} ms`)),
        timeout
      );
  });
  const interval = setInterval(() => xz.kill("SIGALRM"), 1000);
  try {
    await Promise.race([
      Promise.all([
        completed(dockerSave, "docker save", () => dockerStderr),
        completed(xz, "xz", () => compressionStderr),
        pipeline(dockerSave.stdout, xz.stdin),
        pipeline(xz.stdout, fs.createWriteStream(temporaryPath))
      ]),
      timeoutPromise
    ]);
    await fs.promises.rename(temporaryPath, destPath);
    return `Compressed image saved to ${destPath}`;
  } catch (error) {
    dockerSave.kill("SIGKILL");
    xz.kill("SIGKILL");
    throw error;
  } finally {
    clearInterval(interval);
    if (timer) clearTimeout(timer);
    await fs.promises.rm(temporaryDir, { recursive: true, force: true });
  }
}
