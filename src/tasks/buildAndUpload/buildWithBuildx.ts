import { ListrTask } from "listr";
import semver from "semver";
import { shell } from "../../utils/shell.js";
import { PackageImage, PackageImageLocal } from "../../types.js";
import { saveAndCompressImagesCached } from "../saveAndCompressImages.js";
import { getDockerVersion } from "../../utils/getDockerVersion.js";
import { Architecture, Compose, Manifest } from "@dappnode/types";
import { tmpComposeFileName } from "../../params.js";
import { writeTmpCompose } from "./utils.js";
import path from "path";

const minimumDockerVersion = "19.3.0";
const buildxInstanceName = "dappnode-multiarch-builder";

/**
 * Save docker image
 * This step is extremely expensive computationally.
 * A local cache file will prevent unnecessary compressions if the image hasn't changed
 */
export function buildWithBuildx({
  architecture,
  images,
  compose,
  manifest,
  destPath,
  buildTimeout,
  skipSave,
  rootDir
}: {
  architecture: Architecture;
  images: PackageImage[];
  compose: Compose;
  manifest: Manifest;
  destPath: string;
  buildTimeout: number;
  skipSave?: boolean;
  rootDir: string;
}): ListrTask[] {
  const localImages = images.filter(
    (image): image is PackageImageLocal => image.type === "local"
  );

  const tmpComposePath = path.join(rootDir, tmpComposeFileName);

  // Write the compose to a temporary file
  writeTmpCompose({
    compose,
    composeFileName: tmpComposeFileName,
    manifest,
    rootDir
  });

  return [
    {
      title: "Build docker image",
      enabled: () => localImages.length > 0,
      task: async (_, task) => {
        // Must enable this flag for buildx to work on all environments
        process.env.DOCKER_CLI_EXPERIMENTAL = "enabled";

        // Make sure `docker version` is >= 19.03
        const dockerVersion = await getDockerVersion();
        if (dockerVersion && semver.lt(dockerVersion, minimumDockerVersion))
          throw Error(
            `docker version must be at least ${minimumDockerVersion} to use buildx`
          );

        switch (architecture) {
          case "linux/arm64":
            await shell(
              `docker run --privileged --rm tonistiigi/binfmt --uninstall qemu-*`
            );
            await shell(
              `docker run --privileged --rm tonistiigi/binfmt --install all`
            );
            // Make sure QEMU is enabled
            // `cat /proc/sys/fs/binfmt_misc/qemu-aarch64`
            break;
        }

        const currentInstances = await shell(`docker buildx ls`);
        if (currentInstances.includes(buildxInstanceName)) {
          await shell(`docker buildx use ${buildxInstanceName}`);
        } else {
          await shell(
            `docker buildx create --name ${buildxInstanceName} --use`
          );
        }

        // Will build all services defined in the compose in paralel
        // The resulting images will be imported to docker with the tag declared in the service
        await shell(
          [
            "docker buildx bake",
            "--progress plain",
            "--load",
            `--file ${tmpComposePath}`,
            `--set=*.platform=${architecture}`
          ].join(" "),
          {
            timeout: buildTimeout,
            maxBuffer: 100 * 1e6,
            onData: data => (task.output = data)
          }
        );

        const firstImage = images.find(image => image.type === "local");
        if (firstImage) {
          const firstImageTag = firstImage.imageTag;
          // Make sure the built was done for the correct architecture
          switch (architecture) {
            case "linux/arm64": {
              const res = await shell(
                `docker run --rm --entrypoint="" ${firstImageTag} uname -m`
              ).catch(() => {
                // Ignore all errors
              });
              if (res && res !== "aarch64")
                throw Error(`Unexpected resulting architecture: ${res}`);
              else task.output = `Validated ${firstImageTag} architecture`;
              break;
            }
          }
        }
      }
    },

    ...saveAndCompressImagesCached({
      images,
      architecture,
      destPath,
      buildTimeout,
      skipSave
    }),
    {
      title: "Cleanup temporary files",
      task: async () => shell(`rm ${tmpComposePath}`)
    }
  ];
}
