import fs from "fs";
import path from "path";
import { mock } from "node:test";
import inquirer from "inquirer";
import { expect } from "chai";
import { writePackageFiles } from "../../src/commands/init/fileOperations.js";
import { temporaryDirectory } from "../helpers/fixtures.js";

describe("initialization overwrite safety", () => {
  let dir: string;
  beforeEach(() => {
    dir = temporaryDirectory();
    fs.writeFileSync(
      path.join(dir, "dappnode_package.json"),
      '{"original":true}'
    );
    fs.writeFileSync(path.join(dir, "Dockerfile"), "ORIGINAL DOCKERFILE");
  });
  afterEach(() => {
    mock.restoreAll();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function write(force = false) {
    return writePackageFiles({
      dir,
      force,
      useVariants: false,
      answers: { name: "demo.public.dappnode.eth", version: "0.1.0" },
      rootManifest: { name: "demo.public.dappnode.eth", version: "0.1.0" },
      rootCompose: { version: "3.5", services: { app: { build: "." } } },
      composeFileName: "docker-compose.yml",
      serviceName: "app"
    });
  }

  it("makes no writes while confirmation is pending or after it is declined", async () => {
    let answer: (value: { continue: boolean }) => void = () => {};
    mock.method(
      inquirer,
      "prompt",
      () =>
        new Promise(resolve => {
          answer = resolve;
        })
    );
    const pending = write();
    expect(
      fs.readFileSync(path.join(dir, "dappnode_package.json"), "utf8")
    ).to.equal('{"original":true}');
    answer({ continue: false });
    const error = await pending.catch(error => error);
    expect(error.message).to.equal("Stopping");
    expect(fs.readFileSync(path.join(dir, "Dockerfile"), "utf8")).to.equal(
      "ORIGINAL DOCKERFILE"
    );
  });

  it("preserves an existing Dockerfile when only manifest overwrite is confirmed", async () => {
    mock.method(inquirer, "prompt", async () => ({ continue: true }));
    await write();
    expect(fs.readFileSync(path.join(dir, "Dockerfile"), "utf8")).to.equal(
      "ORIGINAL DOCKERFILE"
    );
    expect(
      JSON.parse(
        fs.readFileSync(path.join(dir, "dappnode_package.json"), "utf8")
      ).name
    ).to.equal("demo.public.dappnode.eth");
  });
});
