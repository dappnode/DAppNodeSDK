import fs from "fs";
import path from "path";
import { expect } from "chai";
import Listr from "listr";
import {
  getCreateReleaseTask,
  getReleaseAssetPattern
} from "../../src/tasks/createGithubRelease/subtasks/getCreateReleaseTask.js";
import { Github } from "../../src/providers/github/Github.js";
import type { ListrContextPublish } from "../../src/types.js";
import { temporaryDirectory } from "../helpers/fixtures.js";

describe("complete GitHub releases", () => {
  let dir: string;
  let ctx: ListrContextPublish;
  beforeEach(() => {
    dir = temporaryDirectory();
    fs.writeFileSync(
      path.join(dir, "dappnode_package.json"),
      '{"name":"demo.public.dappnode.eth","version":"0.1.0"}'
    );
    fs.writeFileSync(
      path.join(dir, "docker-compose.yml"),
      'version: "3.5"\nservices:\n  app:\n    image: demo:1\n'
    );
    for (const name of [
      "setup-wizard.json",
      "setup.schema.json",
      "setup-ui.json",
      "dashboard-grafana-dashboard.json"
    ])
      fs.writeFileSync(path.join(dir, name), "{}");
    fs.writeFileSync(path.join(dir, "avatar.png"), "avatar");
    fs.writeFileSync(path.join(dir, "image.txz"), "image");
    ctx = {
      "demo.public.dappnode.eth": {
        variant: null,
        releaseDir: dir,
        nextVersion: "0.1.0",
        releaseMultiHash: "/ipfs/QmTest",
        txData: {
          to: "0x0000000000000000000000000000000000001234",
          value: 0,
          data: "0x",
          gasLimit: 300000,
          ensName: "demo.public.dappnode.eth",
          currentVersion: "0.1.0",
          releaseMultiHash: "/ipfs/QmTest"
        }
      }
    };
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("includes every defined optional release artifact", async () => {
    const uploaded: string[] = [];
    const github = {
      deleteReleaseAndAssets: async () => {},
      createRelease: async () => 1,
      uploadReleaseAssets: async ({
        matchPattern
      }: {
        matchPattern: RegExp;
      }) => {
        uploaded.push(
          ...fs.readdirSync(dir).filter(file => matchPattern.test(file))
        );
      }
    } as unknown as Github;
    await new Listr([getCreateReleaseTask({ github, isMultiVariant: false })], {
      renderer: "silent"
    }).run(ctx);
    expect(uploaded).to.include.members([
      "setup-wizard.json",
      "setup.schema.json",
      "setup-ui.json",
      "dashboard-grafana-dashboard.json",
      "image.txz",
      "avatar.png"
    ]);
  });

  it("uploads a Compose file with a custom --compose-file-name", async () => {
    fs.renameSync(
      path.join(dir, "docker-compose.yml"),
      path.join(dir, "docker-compose.yaml")
    );
    const uploaded: string[] = [];
    const github = {
      deleteReleaseAndAssets: async () => {},
      createRelease: async () => 1,
      uploadReleaseAssets: async ({
        matchPattern
      }: {
        matchPattern: RegExp;
      }) => {
        uploaded.push(
          ...fs.readdirSync(dir).filter(file => matchPattern.test(file))
        );
      }
    } as unknown as Github;
    await new Listr(
      [
        getCreateReleaseTask({
          github,
          isMultiVariant: false,
          composeFileName: "docker-compose.yaml"
        })
      ],
      { renderer: "silent" }
    ).run(ctx);
    expect(uploaded).to.include("docker-compose.yaml");
  });

  it("matches the configured Compose file name exactly", () => {
    const pattern = getReleaseAssetPattern("production.yml");
    expect(pattern.test("production.yml")).to.equal(true);
    expect(pattern.test("productionXyml")).to.equal(false);
    expect(getReleaseAssetPattern().test("production.yml")).to.equal(false);
    expect(getReleaseAssetPattern().test("docker-compose.yml")).to.equal(true);
  });

  it("fails the release when asset upload fails", async () => {
    const github = {
      deleteReleaseAndAssets: async () => {},
      createRelease: async () => 1,
      uploadReleaseAssets: async () => {
        throw new Error("upload failed");
      }
    } as unknown as Github;
    const error = await new Listr(
      [getCreateReleaseTask({ github, isMultiVariant: false })],
      { renderer: "silent" }
    )
      .run(ctx)
      .catch(error => error);
    expect(error.message).to.equal("upload failed");
  });
});
