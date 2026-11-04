import fs from "fs";
import path from "path";
import http from "http";
import { expect } from "chai";
import { pinataAddFromFs } from "../../src/releaseUploader/pinata/addDirFromFs.js";
import { swarmAddDirFromFs } from "../../src/releaseUploader/swarmNode/addDirFromFs.js";
import { ipfsAddDirFromUrls } from "../../src/releaseUploader/ipfsNode/addDirFromUrls.js";
import { temporaryDirectory } from "../helpers/fixtures.js";

describe("local upload transport and progress", function () {
  this.timeout(10000);
  let dir: string;
  let server: http.Server;
  let url: string;
  let route: (
    request: http.IncomingMessage,
    response: http.ServerResponse
  ) => void;
  beforeEach(async () => {
    dir = temporaryDirectory();
    fs.writeFileSync(path.join(dir, "image.txz"), Buffer.alloc(1024 * 1024, 7));
    server = http.createServer((request, response) => route(request, response));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No server address");
    url = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => {
    server?.closeAllConnections();
    await new Promise<void>(resolve => server?.close(() => resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("changes to pinning confirmation after transmission, before the response", async () => {
    let confirmed = false;
    let sent = false;
    const events: string[] = [];
    route = (request, response) => {
      expect(request.url).to.equal("/pinning/pinFileToIPFS");
      request.resume();
      request.on("end", () =>
        setTimeout(() => {
          expect(sent).to.equal(true);
          confirmed = true;
          response.setHeader("content-type", "application/json");
          response.end('{"IpfsHash":"QmTest"}');
        }, 100)
      );
    };
    const hash = await pinataAddFromFs({
      dirOrFilePath: dir,
      pinataUrl: url,
      credentials: { apiKey: "fake", secretApiKey: "fake" },
      onProgress: percent => events.push(`bytes:${percent}`),
      onUploadComplete: () => {
        sent = true;
        expect(confirmed).to.equal(false);
        events.push("pinning");
      }
    });
    expect(hash).to.equal("/ipfs/QmTest");
    expect(events.at(-1)).to.equal("pinning");
  });

  it("posts Swarm archives using a relative path under prefixUrl", async () => {
    route = (request, response) => {
      expect(request.url).to.equal("/bzz:/");
      request.resume();
      request.on("end", () => response.end("swarm-hash"));
    };
    expect(await swarmAddDirFromFs(dir, url)).to.equal("/bzz/swarm-hash");
  });

  it("streams GitHub-style downloads through got into the IPFS upload", async () => {
    let upload = "";
    route = (request, response) => {
      if (request.url === "/asset") {
        response.end("downloaded contents");
        return;
      }
      expect(request.url).to.equal("/api/v0/add");
      request.setEncoding("utf8");
      request.on("data", chunk => {
        upload += chunk;
      });
      request.on("end", () =>
        response.end('{"Name":"release","Hash":"QmDownloaded"}\n')
      );
    };
    expect(
      await ipfsAddDirFromUrls(
        [{ filepath: "release/file.txt", url: `${url}/asset` }],
        url
      )
    ).to.equal("/ipfs/QmDownloaded");
    expect(upload)
      .to.include("downloaded contents")
      .and.include("release/file.txt");
  });

  it("rejects HTTP failures during downloads instead of uploading an error page", async () => {
    route = (request, response) => {
      if (request.url === "/missing") {
        response.writeHead(404);
        response.end("missing");
        return;
      }
      request.resume();
    };
    const error = await ipfsAddDirFromUrls(
      [{ filepath: "release/file.txt", url: `${url}/missing` }],
      url
    ).catch(error => error);
    expect(error).to.be.instanceOf(Error);
    expect(error.message).to.include("404");
  });
});
