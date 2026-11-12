import { expect } from "chai";
import {
  createServer,
  Server,
  IncomingMessage,
  ServerResponse
} from "node:http";
import { AddressInfo } from "node:net";
import { createHash } from "node:crypto";
import {
  manifestAccept,
  RegistryClient,
  parseRegistryImage
} from "../../src/bump/registry.js";

const digest = `sha256:${"b".repeat(64)}`;

describe("bump / registry", () => {
  let server: Server;
  let host: string;
  let handler: (request: IncomingMessage, response: ServerResponse) => void;
  const registry = new RegistryClient();
  beforeEach(async () => {
    server = createServer((request, response) => handler(request, response));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(async () => {
    if (!server.listening) return;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    );
  });
  async function rejects(
    task: Promise<unknown>,
    message: string
  ): Promise<void> {
    try {
      await task;
    } catch (error) {
      expect(error.message).to.include(message);
      return;
    }
    throw Error(`Expected rejection: ${message}`);
  }

  it("normalizes Docker Hub and explicit registry names", () => {
    for (const image of [
      "alpine",
      "docker.io/alpine",
      "index.docker.io/library/alpine"
    ])
      expect(parseRegistryImage(image)).to.deep.equal({
        host: "registry-1.docker.io",
        name: "library/alpine",
        isDockerHub: true
      });
    expect(parseRegistryImage("org/app").name).to.equal("org/app");
    expect(parseRegistryImage("ghcr.io/org/app")).to.deep.equal({
      host: "ghcr.io",
      name: "org/app",
      isDockerHub: false
    });
    for (const host of ["evil-docker.io", "docker.io.evil.com"])
      expect(parseRegistryImage(`${host}/org/app`)).to.deep.equal({
        host,
        name: "org/app",
        isDockerHub: false
      });
  });

  it("answers a bearer challenge, using token or access_token and pull scope", async () => {
    for (const tokenKey of ["token", "access_token"]) {
      const requests: string[] = [];
      handler = (request, response) => {
        requests.push(`${request.method} ${request.url}`);
        if (request.url?.startsWith("/token")) {
          const url = new URL(request.url, `http://${host}`);
          expect(url.searchParams.get("service")).to.equal("registry");
          expect(url.searchParams.get("scope")).to.equal(
            "repository:org/app:pull"
          );
          response.end(JSON.stringify({ [tokenKey]: "anonymous" }));
        } else if (request.headers.authorization !== "Bearer anonymous") {
          response
            .writeHead(401, {
              "WWW-Authenticate": `Bearer realm="http://${host}/token",service="registry",scope="ignored"`
            })
            .end();
        } else {
          expect(request.method).to.equal("HEAD");
          expect(request.headers.accept).to.equal(manifestAccept);
          response.writeHead(200, { "Docker-Content-Digest": digest }).end();
        }
      };
      expect(
        await registry.manifestDigest(`${host}/org/app`, "v1.0.0")
      ).to.equal(digest);
      expect(requests).to.have.length(3);
    }
  });

  it("hashes GET bytes when the HEAD digest is absent", async () => {
    const bytes = Buffer.from(
      '{"mediaType":"application/vnd.oci.image.index.v1+json"}\n'
    );
    const methods: string[] = [];
    handler = (request, response) => {
      methods.push(request.method!);
      response.end(request.method === "HEAD" ? undefined : bytes);
    };
    expect(await registry.manifestDigest(`${host}/org/app`, "1.0.0")).to.equal(
      `sha256:${createHash("sha256").update(bytes).digest("hex")}`
    );
    expect(methods).to.deep.equal(["HEAD", "GET"]);
  });

  it("distinguishes missing tags from errors and rejects invalid digest headers", async () => {
    handler = (request, response) =>
      response.writeHead(request.url?.endsWith("missing") ? 404 : 500).end();
    expect(await registry.tagExists(`${host}/org/app`, "missing")).to.equal(
      false
    );
    await rejects(registry.tagExists(`${host}/org/app`, "error"), "500");
    await rejects(registry.manifestDigest(`${host}/org/app`, "missing"), "404");
    handler = (request, response) =>
      response
        .writeHead(200, { "Docker-Content-Digest": `sha256:${"B".repeat(64)}` })
        .end();
    await rejects(
      registry.manifestDigest(`${host}/org/app`, "v1"),
      "malformed digest"
    );
  });

  it("follows OCI Link pagination and picks the highest stable tag", async () => {
    const paths: string[] = [];
    handler = (request, response) => {
      paths.push(request.url!);
      response.setHeader("Content-Type", "application/json");
      if (request.url === "/v2/org/app/tags/list") {
        response.setHeader(
          "Link",
          '</v2/org/app/tags/list?last=v2>; rel="next"'
        );
        response.end(JSON.stringify({ tags: ["v2.0.0", "3.0.0-rc.1"] }));
      } else response.end(JSON.stringify({ tags: ["2.0.0", "1.0.0"] }));
    };
    expect(await registry.latestTag(`${host}/org/app`)).to.equal("2.0.0");
    expect(paths).to.have.length(2);
  });

  it("follows Docker Hub next pages and selects semver instead of update order", async () => {
    const urls: string[] = [];
    const client = new RegistryClient(async input => {
      const url = String(input);
      urls.push(url);
      return Response.json(
        urls.length === 1
          ? {
              results: [{ name: "v1.0.0" }, { name: "9.0.0-rc.1" }],
              next: "https://registry.hub.docker.com/next"
            }
          : { results: [{ name: "2.0.0" }, { name: "v2.0.0" }], next: null }
      );
    });
    expect(await client.latestTag("alpine")).to.equal("2.0.0");
    expect(urls[0]).to.equal(
      "https://registry.hub.docker.com/v2/repositories/library/alpine/tags?page_size=100&ordering=last_updated"
    );
  });

  it("caps pagination and retries bearer authentication only once", async () => {
    let pages = 0;
    handler = (request, response) => {
      pages++;
      response.setHeader(
        "Link",
        `</v2/org/app/tags/list?page=${pages}>; rel=next`
      );
      response.end('{"tags":[]}');
    };
    await rejects(registry.listTags(`${host}/org/app`), "exceeded 50 pages");
    expect(pages).to.equal(50);
    let challenges = 0;
    handler = (request, response) => {
      if (request.url?.startsWith("/token")) response.end('{"token":"denied"}');
      else {
        challenges++;
        response
          .writeHead(401, {
            "WWW-Authenticate": `Bearer realm="http://${host}/token"`
          })
          .end();
      }
    };
    await rejects(registry.tagExists(`${host}/org/app`, "v1"), "401");
    expect(challenges).to.equal(2);
  });
});
