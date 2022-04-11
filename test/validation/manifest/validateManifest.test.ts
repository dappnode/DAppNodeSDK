import { expect } from "chai";
import { readManifest } from "../../../src/validation/manifest/manifest";
import { validateManifest } from "../../../src/validation/manifest/validateManifest";

describe("validation / Manifest", () => {
  const manifestDir = "test/validation/manifest";

  it("Should read and validate a valid Manifest file", () => {
    const manifest = readManifest({
      dir: manifestDir,
      manifestFileName: "good-dappnode_package.json"
    });

    validateManifest(manifest.manifest);
  });

  it("Should read and not validate an invalid Manifest file", () => {
    const manifest = readManifest({
      dir: manifestDir,
      manifestFileName: "bad-dappnode_package.json"
    });

    // expect to throw error
    expect(() => validateManifest(manifest.manifest)).to.throw();
  });
});
