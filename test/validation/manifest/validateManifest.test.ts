import { expect } from "chai";
import { readManifest } from "../../../src/releaseFiles/manifest/manifest";
import { validateSchema } from "../../../src/releaseFiles/validateSchema";
import { ReleaseFileType } from "../../../src/types";

describe("validation / Manifest", () => {
  const manifestDir = "test/validation/manifest";

  it("Should read and validate a valid Manifest file", () => {
    const manifest = readManifest({
      dir: manifestDir,
      manifestFileName: "good-dappnode_package.json"
    });

    validateSchema({ type: ReleaseFileType.manifest, data: manifest.manifest });
  });

  it("Should read and not validate an invalid Manifest file", () => {
    const manifest = readManifest({
      dir: manifestDir,
      manifestFileName: "bad-dappnode_package.json"
    });

    // expect to throw error
    expect(() =>
      validateSchema({
        type: ReleaseFileType.manifest,
        data: manifest.manifest
      })
    ).to.throw();
  });
});
