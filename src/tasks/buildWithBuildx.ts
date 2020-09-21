import { ListrTask } from "listr";
import semver from "semver";
import { shell } from "../utils/shell";
import { Architecture } from "../types";
import { saveAndCompressImagesCached } from "./saveAndCompressImages";
import { getDockerVersion } from "../utils/getDockerVersion";

const minimumDockerVersion = "19.03.0";
const buildxInstanceName = "dappnode-multiarch-builder";

/**
 * Save docker image
 * This step is extremely expensive computationally.
 * A local cache file will prevent unnecessary compressions if the image hasn't changed
 */
export function buildWithBuildx({
  architecture,
  imageTags,
  composePath,
  destPath,
  buildTimeout,
  skipSave
}: {
  architecture: Architecture;
  imageTags: string[];
  composePath: string;
  destPath: string;
  buildTimeout: number;
  skipSave?: boolean;
}): ListrTask[] {
  return [
    {
      title: "Build docker image",
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
              `docker run --rm --privileged docker/binfmt:a7996909642ee92942dcd6cff44b9b95f08dad64`
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
            `--file ${composePath}`,
            `--set=*.platform=${architecture}`
          ].join(" "),
          {
            timeout: buildTimeout,
            maxBuffer: 100 * 1e6,
            onData: data => (task.output = data)
          }
        );

        // Make sure the built was done for the correct architecture
        switch (architecture) {
          case "linux/arm64": {
            const res = await shell(
              `docker run --rm --entrypoint="" ${imageTags[0]} uname -m`
            );
            if (res !== "aarch64")
              throw Error(`Unexpected resulting architecture: ${res}`);
            else task.output = `Validated ${imageTags[0]} architecture`;
            break;
          }
        }
      }
    },

    saveAndCompressImagesCached({
      imageTags,
      destPath,
      buildTimeout,
      skipSave
    })
  ];
}
