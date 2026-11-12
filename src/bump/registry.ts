import { createHash } from "crypto";
import { highestSemverTag } from "./versions.js";

export const manifestAccept =
  "application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json";
export const digestPattern = /^sha256:[a-f0-9]{64}$/;

/** Exact host names that address Docker Hub. */
const dockerHubHosts = new Set([
  "docker.io",
  "index.docker.io",
  "registry-1.docker.io"
]);
const dockerHubRegistryHost = "registry-1.docker.io";
const requestTimeoutMs = 30000;
const maxTagPages = 50;

export interface RegistryImage {
  /** Registry host, `registry-1.docker.io` for Docker Hub. */
  host: string;
  /** Repository name, with `library/` for official Docker Hub images. */
  name: string;
  isDockerHub: boolean;
}

/**
 * Splits an image reference without tag into its registry host and name.
 * Images without a registry host are on Docker Hub.
 */
export function parseRegistryImage(image: string): RegistryImage {
  const parts = image.split("/");
  const hasHost =
    parts.length > 1 && (/[.:]/.test(parts[0]) || parts[0] === "localhost");
  const host = hasHost ? parts.shift()! : "docker.io";
  const name = parts.join("/");

  if (!dockerHubHosts.has(host)) return { host, name, isDockerHub: false };

  return {
    host: dockerHubRegistryHost,
    name: name.includes("/") ? name : `library/${name}`,
    isDockerHub: true
  };
}

/**
 * Anonymous client for the Docker registry HTTP API, used to check image tags,
 * read manifest digests and list tags. Answers bearer token challenges.
 */
export class RegistryClient {
  constructor(private readonly request: typeof fetch = fetch) {}

  async tagExists(image: string, tag: string): Promise<boolean> {
    const { url, name } = getManifestUrl(image, tag);
    const response = await this.send(url, "HEAD", name, manifestAccept);
    if (response.status === 200) return true;
    if (response.status === 404) return false;
    throw Error(
      `Registry returned ${response.status} checking ${image}:${tag}`
    );
  }

  /**
   * Returns the digest of an image tag, from the `Docker-Content-Digest`
   * header or, when the registry does not send it, by hashing the manifest.
   */
  async manifestDigest(image: string, tag: string): Promise<string> {
    const { url, name } = getManifestUrl(image, tag);
    const head = await this.send(url, "HEAD", name, manifestAccept);
    if (head.status !== 200)
      throw Error(`Registry returned ${head.status} pinning ${image}:${tag}`);

    const digest =
      head.headers.get("docker-content-digest")?.trim() ??
      (await this.hashManifest(url, name, `${image}:${tag}`));
    if (!digestPattern.test(digest))
      throw Error(
        `Registry returned malformed digest for ${image}:${tag}: ${digest}`
      );

    return digest;
  }

  /**
   * Lists the tags of an image. Docker Hub tags come from its own API, other
   * registries' from the OCI tag list.
   */
  async listTags(image: string): Promise<string[]> {
    const { host, name, isDockerHub } = parseRegistryImage(image);
    let url: string | null = isDockerHub
      ? `https://registry.hub.docker.com/v2/repositories/${name}/tags?page_size=100&ordering=last_updated`
      : `${getRegistryScheme(host)}://${host}/v2/${name}/tags/list`;

    const tags: string[] = [];
    const visitedUrls = new Set<string>();
    for (let page = 0; url && page < maxTagPages; page++) {
      if (visitedUrls.has(url))
        throw Error(`Registry pagination loop for ${image}`);
      visitedUrls.add(url);

      const response = await this.send(url, "GET", name);
      if (response.status !== 200)
        throw Error(`Registry returned ${response.status} listing ${image}`);

      const tagPage = isDockerHub
        ? await readDockerHubTagPage(response)
        : await readOciTagPage(response);
      tags.push(...tagPage.tags);
      url = tagPage.next ? new URL(tagPage.next, url).href : null;
    }

    if (url)
      throw Error(`Tag listing exceeded ${maxTagPages} pages for ${image}`);
    return tags;
  }

  async latestTag(image: string): Promise<string | null> {
    return highestSemverTag(await this.listTags(image));
  }

  private async hashManifest(
    url: string,
    name: string,
    imageRef: string
  ): Promise<string> {
    const response = await this.send(url, "GET", name, manifestAccept);
    if (response.status !== 200)
      throw Error(`Registry returned ${response.status} pinning ${imageRef}`);

    const manifest = Buffer.from(await response.arrayBuffer());
    return `sha256:${createHash("sha256").update(manifest).digest("hex")}`;
  }

  /**
   * Sends a registry request. On a 401 bearer challenge, fetches an anonymous
   * pull token for `name` and retries once with it.
   */
  private async send(
    url: string,
    method: string,
    name: string,
    accept = "application/json"
  ): Promise<Response> {
    assertSecureUrl(url);
    const headers: Record<string, string> = { Accept: accept };

    const response = await this.fetchWithTimeout(url, { method, headers });
    if (response.status !== 401) return response;

    const token = await this.getBearerToken(
      response.headers.get("www-authenticate") || "",
      name
    );
    headers.Authorization = `Bearer ${token}`;
    return this.fetchWithTimeout(url, { method, headers });
  }

  private async getBearerToken(
    challenge: string,
    name: string
  ): Promise<string> {
    if (!/^Bearer\s/i.test(challenge))
      throw Error("Registry authentication failed (401)");

    const params = parseChallengeParams(challenge);
    const realm = params.get("realm");
    if (!realm) throw Error("Registry bearer challenge has no realm");

    const tokenUrl = assertSecureUrl(realm);
    const service = params.get("service");
    if (service) tokenUrl.searchParams.set("service", service);
    tokenUrl.searchParams.set("scope", `repository:${name}:pull`);

    const response = await this.fetchWithTimeout(tokenUrl);
    if (response.status !== 200)
      throw Error(`Registry token request failed (${response.status})`);

    const body = (await response.json()) as {
      token?: string;
      access_token?: string;
    };
    const token = body.token || body.access_token;
    if (!token) throw Error("Registry token response has no token");
    return token;
  }

  private fetchWithTimeout(
    url: string | URL,
    init: RequestInit = {}
  ): Promise<Response> {
    return this.request(url, {
      ...init,
      signal: AbortSignal.timeout(requestTimeoutMs)
    });
  }
}

function getManifestUrl(
  image: string,
  tag: string
): { url: string; name: string } {
  const { host, name } = parseRegistryImage(image);
  const scheme = getRegistryScheme(host);
  const url = `${scheme}://${host}/v2/${name}/manifests/${encodeURIComponent(
    tag
  )}`;
  return { url, name };
}

/** Local registries, as used in tests, are served over plain HTTP. */
function getRegistryScheme(host: string): "http" | "https" {
  const hostname = host.startsWith("[") ? host : host.split(":")[0];
  return isLoopback(hostname) ? "http" : "https";
}

function assertSecureUrl(value: string): URL {
  const url = new URL(value);
  const isLocalHttp = url.protocol === "http:" && isLoopback(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp)
    throw Error(`Registry URL must use HTTPS: ${url.origin}`);
  return url;
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.startsWith("[::1]") ||
    /^127\.\d+\.\d+\.\d+$/.test(hostname)
  );
}

/** Parses `key="value"` and `key=value` pairs of a WWW-Authenticate header. */
function parseChallengeParams(challenge: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const match of challenge.matchAll(
    /([a-z_]+)=(?:"([^"]*)"|([^,\s]+))/gi
  )) {
    params.set(match[1].toLowerCase(), match[2] ?? match[3]);
  }
  return params;
}

async function readDockerHubTagPage(
  response: Response
): Promise<{ tags: string[]; next?: string | null }> {
  const body = (await response.json()) as {
    results: { name: string }[];
    next?: string | null;
  };
  return { tags: body.results.map(tag => tag.name), next: body.next };
}

/** The next page of an OCI tag list is in the `Link: <url>; rel="next"` header. */
async function readOciTagPage(
  response: Response
): Promise<{ tags: string[]; next?: string }> {
  const body = (await response.json()) as { tags?: string[] | null };
  const next = response.headers
    .get("link")
    ?.split(",")
    .map(link => /<([^>]+)>\s*;\s*rel\s*=\s*"?next"?/i.exec(link)?.[1])
    .find(Boolean);
  return { tags: body.tags || [], next };
}
