import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { expect } from "chai";
import Listr from "listr";
import { initHandler } from "../../src/commands/init/handler.js";
import { buildWithCompose } from "../../src/tasks/buildAndUpload/buildWithCompose.js";
import {
  temporaryDirectory,
  executable,
  useExecutables
} from "../helpers/fixtures.js";

const execute = promisify(execFile);
describe("build commands and native architecture", function () {
  this.timeout(15000);
  let dir: string;
  let bin: string;
  let restorePath: () => void;
  beforeEach(async () => {
    dir = temporaryDirectory();
    bin = path.join(dir, "bin");
    await initHandler({ dir, yes: true, force: true });
    const manifestPath = path.join(dir, "dappnode_package.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.architectures = ["linux/amd64", "linux/arm64"];
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    executable(
      bin,
      "docker",
      `
      const fs = require('fs');
      const args = process.argv.slice(2);
      if (args[0] === 'pull') fs.appendFileSync(${JSON.stringify(path.join(dir, "pulls.jsonl"))}, JSON.stringify(args)+'\\n');
      if (args[0] === 'image') console.log(JSON.stringify([{Os:'linux',Architecture:'arm64'}]));
      if (args[0] === 'compose' && args.includes('build')) {process.stdout.write('building'); setTimeout(() => process.stdout.write(' layer\\n'), 15);}
    `
    );
    restorePath = useExecutables(bin);
  });
  afterEach(() => {
    restorePath();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reports a successful build when --skip-save implicitly skips uploading", async () => {
    const arch = os.arch() === "arm64" ? "arm64" : "amd64";
    const { stdout } = await execute(process.execPath, [
      "--import=tsx",
      "src/dappnodesdk.ts",
      "build",
      "--dir",
      dir,
      "--arch",
      arch,
      "--skip-save"
    ]);
    expect(stdout).to.include("DNP (DAppNode Package) built");
    expect(stdout).not.to.include("Error building");
    expect(stdout).to.include("building layer");
  });

  it("shows resolved variant names and builds each selected template", async () => {
    await initHandler({ dir, yes: true, force: true, use_variants: true });
    const manifestPath = path.join(dir, "dappnode_package.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.architectures = ["linux/amd64", "linux/arm64"];
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const arch = os.arch() === "arm64" ? "arm64" : "amd64";
    const { stdout } = await execute(process.execPath, [
      "--import=tsx",
      "src/dappnodesdk.ts",
      "build",
      "--dir",
      dir,
      "--all-variants",
      "--arch",
      arch,
      "--skip-save"
    ]);
    expect(stdout).to.include("mainnet, testnet");
    expect(stdout).not.to.include("undefined");
    expect(stdout).to.include("[1/2]").and.include("[2/2]");
  });

  it("honors --dir in pull-request GitHub action builds", async () => {
    const { stdout } = await execute(
      process.execPath,
      [
        "--import=tsx",
        "src/dappnodesdk.ts",
        "github-action",
        "build",
        "--dir",
        dir
      ],
      {
        env: {
          ...process.env,
          GITHUB_TOKEN: "",
          GITHUB_EVENT_NAME: "pull_request",
          GITHUB_REF: "refs/pull/1/merge",
          GITHUB_REPOSITORY: "example/demo"
        }
      }
    );
    expect(stdout).to.include(path.basename(dir).toLowerCase());
    expect(stdout).to.include("[completed]");
  });

  it("uses the requested native platform for external images", async () => {
    const tasks = buildWithCompose({
      architecture: "linux/arm64",
      images: [
        {
          type: "external",
          imageTag: "demo:1",
          originalImageTag: "alpine:3.21"
        }
      ],
      compose: { version: "3.5", services: { app: { image: "alpine:3.21" } } },
      manifest: { name: "demo.public.dappnode.eth", version: "0.1.0" },
      destPath: path.join(dir, "image.txz"),
      buildTimeout: 3000,
      skipSave: true,
      rootDir: dir
    });
    await new Listr(tasks, { renderer: "silent" }).run();
    expect(
      JSON.parse(fs.readFileSync(path.join(dir, "pulls.jsonl"), "utf8").trim())
    ).to.include("--platform=linux/arm64");
  });
});
