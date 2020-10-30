import { expect } from "chai";
import fs from "fs";
import yaml from "js-yaml";
import semver from "semver";
import { rmSafe } from "../../shellSafe";
import { increaseFromApmVersion } from "../../../src/utils/versions/increaseFromApmVersion";
import { generateAndWriteCompose } from "../../../src/utils/compose";
import { Manifest, Compose } from "../../../src/types";
import { stringifyManifest } from "../../../src/utils/manifest";

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
//
// Then it will expect the function to
// - log the next version
// - modify the existing manifest and increase its version
// - generate a docker compose with the next version

describe("increaseFromApmVersion", () => {
  const ensName = "admin.dnp.dappnode.eth";
  const manifest: Manifest = {
    name: ensName,
    version: "0.1.0",
    avatar: "/ipfs/QmUG9Y13BvmKC4RzFu85F7Ai63emnEYrci4pqbbLxt3mt1",
    type: "dncore",
    image: {
      path: "dnpinner.public.dappnode.eth_0.0.1.tar.xz",
      hash: "/ipfs/QmcgHQ17z1UK4poEXDr4bzhiPPtLKxPEZTgiktXgcy1JJU",
      size: 22019270,
      restart: "always"
    }
  };
  const manifestPath = "./dappnode_package.json";
  const composePath = "./docker-compose.yml";
  const dir = "./";

  before(async () => {
    await rmSafe(manifestPath);
    await rmSafe(composePath);
    fs.writeFileSync(manifestPath, stringifyManifest(manifest));
    generateAndWriteCompose(dir, manifest);
  });

  it("Should get the last version from APM", async () => {
    const nextVersion = await increaseFromApmVersion({
      type: "patch",
      ethProvider: "infura",
      dir
    });

    // Check that the console output contains a valid semver version
    expect(semver.valid(nextVersion)).to.be.ok;

    // Check that the compose was edited correctly to the next version
    const composeString = fs.readFileSync(composePath, "utf8");
    const compose = yaml.safeLoad(composeString) as Compose;
    expect(compose.services[ensName].image).to.equal(
      `admin.dnp.dappnode.eth:${nextVersion}`,
      "compose should be edited to the next version"
    );
    // Check that the manifest was edited correctly to the next version
    const newManifestString = fs.readFileSync(manifestPath, "utf8");
    const newManifest = JSON.parse(newManifestString);
    expect(newManifest.version).to.equal(
      nextVersion,
      "manifest should be edited to the next version"
    );
  }).timeout(60 * 1000);

  after(async () => {
    await rmSafe(manifestPath);
    await rmSafe(composePath);
  });
});
