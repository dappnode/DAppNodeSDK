import { expect } from "chai";
import { readReleaseFile } from "../../../src/releaseFiles/readReleaseFile";
import { validateSchema } from "../../../src/releaseFiles/validateSchema";
import { ReleaseFileType } from "../../../src/types";

describe("validation / Manifest", () => {
  const manifestDir = "test/validation/manifest";

  it("Should read and validate a valid Manifest file", () => {
    const manifest = readReleaseFile(ReleaseFileType.manifest, {
      dir: manifestDir,
      releaseFileName: "good-dappnode_package.json"
    });

    validateSchema({
      type: ReleaseFileType.manifest,
      data: manifest.releaseFile
    });
  });

  it("Should read and not validate an invalid Manifest file", () => {
    const manifest = readReleaseFile(ReleaseFileType.manifest, {
      dir: manifestDir,
      releaseFileName: "bad-dappnode_package.json"
    });

    // expect to throw error
    expect(() =>
      validateSchema({
        type: ReleaseFileType.manifest,
        data: manifest.releaseFile
      })
    ).to.throw();
  });
});
