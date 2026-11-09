import fs from "fs";
import path from "path";
import { expect } from "chai";
import { saveAndCompressImages } from "../../src/tasks/saveAndCompressImages.js";
import {
  executable,
  temporaryDirectory,
  useExecutables
} from "../helpers/fixtures.js";

describe("atomic image export", function () {
  this.timeout(10000);
  let dir: string;
  let restorePath: () => void;
  let destPath: string;

  beforeEach(() => {
    dir = temporaryDirectory();
    destPath = path.join(dir, "image.txz");
    fs.writeFileSync(destPath, "previous verified archive");
    executable(
      dir,
      "xz",
      'process.on("SIGALRM", () => {}); process.stdin.pipe(process.stdout);'
    );
    restorePath = useExecutables(dir);
  });
  afterEach(() => {
    restorePath();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a failed docker save and preserves the previous archive", async () => {
    executable(
      dir,
      "docker",
      'process.stderr.write("daemon export failed"); process.exit(42);'
    );
    const error = await saveAndCompressImages({
      imageTags: ["demo:1"],
      destPath,
      timeout: 3000
    }).catch(error => error);
    expect(error).to.be.instanceOf(Error);
    expect(error.message)
      .to.include("docker save failed")
      .and.include("daemon export failed");
    expect(fs.readFileSync(destPath, "utf8")).to.equal(
      "previous verified archive"
    );
    expect(
      fs.readdirSync(dir).some(file => file.startsWith(".dappnodesdk-"))
    ).to.equal(false);
  });

  it("rejects signal termination of the compressor", async () => {
    executable(dir, "docker", 'process.stdout.write("tar payload");');
    executable(
      dir,
      "xz",
      'process.stdin.resume(); process.kill(process.pid, "SIGTERM");'
    );
    const error = await saveAndCompressImages({
      imageTags: ["demo:1"],
      destPath,
      timeout: 3000
    }).catch(error => error);
    expect(error).to.be.instanceOf(Error);
    expect(fs.readFileSync(destPath, "utf8")).to.equal(
      "previous verified archive"
    );
  });

  it("times out and cancels both child processes", async () => {
    executable(dir, "docker", "setInterval(() => {}, 1000);");
    const error = await saveAndCompressImages({
      imageTags: ["demo:1"],
      destPath,
      timeout: 100
    }).catch(error => error);
    expect(error.message).to.include("timed out");
    expect(fs.readFileSync(destPath, "utf8")).to.equal(
      "previous verified archive"
    );
  });

  it("waits for all output before replacing the archive", async () => {
    executable(
      dir,
      "docker",
      "process.stdout.write(Buffer.alloc(2 * 1024 * 1024, 7));"
    );
    await saveAndCompressImages({
      imageTags: ["demo:1"],
      destPath,
      timeout: 3000
    });
    const data = fs.readFileSync(destPath);
    expect(data.length).to.equal(2 * 1024 * 1024);
    expect(data.every(byte => byte === 7)).to.equal(true);
  });
});
