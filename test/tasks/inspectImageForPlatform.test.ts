import fs from "fs";
import { expect } from "chai";
import { inspectImageForPlatform } from "../../src/tasks/saveAndCompressImages.js";
import {
  executable,
  temporaryDirectory,
  useExecutables
} from "../helpers/fixtures.js";

describe("platform-specific image inspection", () => {
  let dir: string;
  let restorePath: () => void;
  beforeEach(() => {
    dir = temporaryDirectory();
    restorePath = useExecutables(dir);
  });
  afterEach(() => {
    restorePath();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("selects the requested platform (containerd store holds several per tag)", async () => {
    executable(
      dir,
      "docker",
      `const p = process.argv.find(a => a.startsWith("--platform="));
       console.log(JSON.stringify([{ Os: "linux", Architecture: p ? p.split("/")[1] : "arm64" }]));`
    );
    const data = JSON.parse(
      await inspectImageForPlatform("demo:1", "linux/amd64")
    );
    expect(data[0].Architecture).to.equal("amd64");
  });

  it("falls back to a plain inspect on Docker CLI versions without --platform", async () => {
    executable(
      dir,
      "docker",
      `if (process.argv.some(a => a.startsWith("--platform"))) {
         process.stderr.write("unknown flag: --platform\\nSee 'docker image inspect --help'.");
         process.exit(125);
       }
       console.log(JSON.stringify([{ Os: "linux", Architecture: "amd64" }]));`
    );
    const data = JSON.parse(
      await inspectImageForPlatform("demo:1", "linux/amd64")
    );
    expect(data[0].Architecture).to.equal("amd64");
  });

  it("does not hide other inspect failures", async () => {
    executable(
      dir,
      "docker",
      `process.stderr.write("No such image: demo:1"); process.exit(1);`
    );
    const error = await inspectImageForPlatform("demo:1", "linux/amd64").catch(
      error => error
    );
    expect(error.message).to.include("No such image");
  });
});
