import { createHash } from "node:crypto";
import { highestSemverTag } from "./versions.js";

export const manifestAccept =
  "application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json";
export const digestPattern = /^sha256:[a-f0-9]{64}$/;

export function registryImage(image: string): {
  host: string;
  name: string;
  hub: boolean;
} {
  const parts = image.split("/");
  const explicit =
    parts.length > 1 && (/[.:]/.test(parts[0]) || parts[0] === "localhost");
  const host = explicit ? parts.shift()! : "docker.io";
  const hub = ["docker.io", "index.docker.io", "registry-1.docker.io"].includes(
    host
  );
  const name = parts.join("/");
  return {
    host: hub ? "registry-1.docker.io" : host,
    name: hub && !name.includes("/") ? `library/${name}` : name,
    hub
  };
}

function checkUrl(value: string): URL {
  const url = new URL(value);
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    throw Error(`Registry URL must use HTTPS: ${url.origin}`);
  return url;
}

export class RegistryClient {
  constructor(private readonly request: typeof fetch = fetch) {}

  private async send(
    url: string,
    method: string,
    name: string,
    accept = "application/json"
  ): Promise<Response> {
    checkUrl(url);
    const headers: Record<string, string> = { Accept: accept };
    const send = () =>
      this.request(url, {
        method,
        headers,
        signal: AbortSignal.timeout(30000)
      });
    let response = await send();
    if (response.status !== 401) return response;
    const challenge = response.headers.get("www-authenticate") || "";
    if (!/^Bearer\s/i.test(challenge))
      throw Error(`Registry authentication failed (${response.status})`);
    const fields = new Map(
      [...challenge.matchAll(/([a-z_]+)=(?:"([^"]*)"|([^,\s]+))/gi)].map(
        match => [match[1].toLowerCase(), match[2] ?? match[3]]
      )
    );
    const realm = fields.get("realm");
    if (!realm) throw Error("Registry bearer challenge has no realm");
    const tokenUrl = checkUrl(realm);
    if (fields.has("service"))
      tokenUrl.searchParams.set("service", fields.get("service")!);
    tokenUrl.searchParams.set("scope", `repository:${name}:pull`);
    const tokenResponse = await this.request(tokenUrl, {
      signal: AbortSignal.timeout(30000)
    });
    if (tokenResponse.status !== 200)
      throw Error(`Registry token request failed (${tokenResponse.status})`);
    const body = (await tokenResponse.json()) as {
      token?: string;
      access_token?: string;
    };
    const token = body.token || body.access_token;
    if (!token) throw Error("Registry token response has no token");
    headers.Authorization = `Bearer ${token}`;
    response = await send();
    return response;
  }

  private manifestUrl(
    image: string,
    tag: string
  ): { url: string; name: string } {
    const { host, name } = registryImage(image);
    const scheme =
      host === "localhost" ||
      host.startsWith("localhost:") ||
      host.startsWith("127.") ||
      host.startsWith("[::1]")
        ? "http"
        : "https";
    return {
      url: `${scheme}://${host}/v2/${name}/manifests/${encodeURIComponent(
        tag
      )}`,
      name
    };
  }

  async tagExists(image: string, tag: string): Promise<boolean> {
    const { url, name } = this.manifestUrl(image, tag);
    const response = await this.send(url, "HEAD", name, manifestAccept);
    if (response.status === 200) return true;
    if (response.status === 404) return false;
    throw Error(
      `Registry returned ${response.status} checking ${image}:${tag}`
    );
  }

  async manifestDigest(image: string, tag: string): Promise<string> {
    const { url, name } = this.manifestUrl(image, tag);
    let response = await this.send(url, "HEAD", name, manifestAccept);
    if (response.status !== 200)
      throw Error(
        `Registry returned ${response.status} pinning ${image}:${tag}`
      );
    let digest = response.headers.get("docker-content-digest")?.trim();
    if (digest === undefined) {
      response = await this.send(url, "GET", name, manifestAccept);
      if (response.status !== 200)
        throw Error(
          `Registry returned ${response.status} pinning ${image}:${tag}`
        );
      digest = `sha256:${createHash("sha256")
        .update(Buffer.from(await response.arrayBuffer()))
        .digest("hex")}`;
    }
    if (!digestPattern.test(digest))
      throw Error(
        `Registry returned malformed digest for ${image}:${tag}: ${digest}`
      );
    return digest;
  }

  async listTags(image: string): Promise<string[]> {
    const { host, name, hub } = registryImage(image);
    const scheme =
      host === "localhost" ||
      host.startsWith("localhost:") ||
      host.startsWith("127.") ||
      host.startsWith("[::1]")
        ? "http"
        : "https";
    let url: string | null = hub
      ? `https://registry.hub.docker.com/v2/repositories/${name}/tags?page_size=100&ordering=last_updated`
      : `${scheme}://${host}/v2/${name}/tags/list`;
    const tags: string[] = [];
    const seen = new Set<string>();
    for (let page = 0; url && page < 50; page++) {
      if (seen.has(url)) throw Error(`Registry pagination loop for ${image}`);
      seen.add(url);
      const response = await this.send(url, "GET", name);
      if (response.status !== 200)
        throw Error(`Registry returned ${response.status} listing ${image}`);
      if (hub) {
        const body = (await response.json()) as {
          results: { name: string }[];
          next?: string | null;
        };
        tags.push(...body.results.map(tag => tag.name));
        url = body.next ? new URL(body.next, url).href : null;
      } else {
        const body = (await response.json()) as { tags?: string[] | null };
        tags.push(...(body.tags || []));
        const link = response.headers.get("link");
        const next: string | undefined = link
          ?.split(",")
          .map(entry => /<([^>]+)>\s*;\s*rel\s*=\s*"?next"?/i.exec(entry)?.[1])
          .find(Boolean);
        url = next ? new URL(next, url).href : null;
      }
    }
    if (url) throw Error(`Tag listing exceeded 50 pages for ${image}`);
    return tags;
  }

  async latestTag(image: string): Promise<string | null> {
    return highestSemverTag(await this.listTags(image));
  }
}
