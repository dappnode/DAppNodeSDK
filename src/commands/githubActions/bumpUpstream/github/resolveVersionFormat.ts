import fs from "fs";
import path from "path";
import { Compose } from "@dappnode/types";

/**
 * Given a GitHub release tag (e.g. "v1.17.0", "n8n@2.10.3"), resolves the
 * correct version format by checking the upstream Docker image registry.
 *
 * 1. Finds which compose service uses the given build arg
 * 2. Parses the Dockerfile to extract the Docker image that uses that arg
 * 3. Checks the Docker registry for tag existence (with/without prefix)
 * 4. Returns the version in the format that matches the Docker registry
 */
export async function resolveVersionFormat({
  tag,
  arg,
  compose,
  dir
}: {
  tag: string;
  arg: string;
  compose: Compose;
  dir: string;
}): Promise<string> {
  const stripped = stripTagPrefix(tag);
  if (!stripped || stripped === tag) return tag; // No prefix to strip

  try {
    const dockerImage = getDockerImageForArg(compose, arg, dir);
    if (!dockerImage) return tag;

    const tagExists = await checkDockerTagExists(dockerImage, stripped);
    if (tagExists) return stripped;

    return tag;
  } catch (e) {
    console.warn(`Could not resolve version format for ${tag}, using as-is:`, e.message);
    return tag;
  }
}

/**
 * Finds the Docker image that uses a given build arg by parsing the Dockerfile.
 */
function getDockerImageForArg(
  compose: Compose,
  arg: string,
  dir: string
): string | null {
  for (const [, service] of Object.entries(compose.services)) {
    if (
      typeof service.build !== "string" &&
      service.build?.args &&
      arg in service.build.args
    ) {
      const buildContext = service.build.context || ".";
      const dockerfileName = service.build.dockerfile || "Dockerfile";
      const dockerfilePath = path.resolve(dir, buildContext, dockerfileName);

      if (!fs.existsSync(dockerfilePath)) continue;

      const content = fs.readFileSync(dockerfilePath, "utf-8");
      return extractImageForArg(content, arg);
    }
  }
  return null;
}

/**
 * Parses a Dockerfile to find the FROM line that references the given ARG,
 * and extracts the Docker image name (without the tag).
 *
 * Handles patterns like:
 *   FROM ethereum/client-go:${UPSTREAM_VERSION}
 *   FROM ethereum/client-go:v${UPSTREAM_VERSION}
 *   FROM ollama/ollama:${OLLAMA_VERSION#v}
 *   FROM statusim/nimbus-eth2:multiarch-${UPSTREAM_VERSION}
 */
function extractImageForArg(
  dockerfileContent: string,
  arg: string
): string | null {
  const lines = dockerfileContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("FROM") || !trimmed.includes(arg)) continue;

    // Match: FROM image:tag_pattern (with optional "AS stage")
    const match = trimmed.match(/^FROM\s+([^:\s]+)/i);
    if (match) return match[1];
  }

  return null;
}

/**
 * Checks if a tag exists on a Docker registry using the Docker Hub v2 API.
 * Supports Docker Hub, ghcr.io, and gcr.io.
 */
async function checkDockerTagExists(
  image: string,
  tag: string
): Promise<boolean> {
  const url = getRegistryTagUrl(image, tag);
  if (!url) return false;

  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

function getRegistryTagUrl(image: string, tag: string): string | null {
  // ghcr.io/org/image -> GitHub Container Registry
  if (image.startsWith("ghcr.io/")) {
    const imagePath = image.replace("ghcr.io/", "");
    return `https://ghcr.io/v2/${imagePath}/manifests/${tag}`;
  }

  // gcr.io/project/image -> Google Container Registry
  if (image.startsWith("gcr.io/")) {
    const imagePath = image.replace("gcr.io/", "");
    return `https://gcr.io/v2/${imagePath}/manifests/${tag}`;
  }

  // Docker Hub: library/image or org/image
  const dockerImage = image.includes("/") ? image : `library/${image}`;
  return `https://registry.hub.docker.com/v2/repositories/${dockerImage}/tags/${tag}`;
}

function stripTagPrefix(tag: string): string | null {
  const match = tag.match(/(\d+\.\d+\.\d+.*)$/);
  return match ? match[1] : null;
}
