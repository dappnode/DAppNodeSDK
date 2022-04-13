import { expect } from "chai";
import { readReleaseFile } from "../../../src/releaseFiles/readReleaseFile";
import { validateSchema } from "../../../src/releaseFiles/validateSchema";
import { ReleaseFileType } from "../../../src/types";

describe("validation / Compose", () => {
  const composeDir = "test/validation/compose";

  it("Should read and validate a valid docker-compose file", () => {
    const compose = readReleaseFile(ReleaseFileType.compose, {
      dir: composeDir,
      releaseFileName: "good-docker-compose.yml"
    });

    validateSchema({
      type: ReleaseFileType.compose,
      data: compose.releaseFile
    });
  });

  it("Should read and not validate an invalid docker-compose file", () => {
    const compose = readReleaseFile(ReleaseFileType.compose, {
      dir: composeDir,
      releaseFileName: "bad-docker-compose.yml"
    });

    // expect to throw error
    expect(() =>
      validateSchema({
        type: ReleaseFileType.compose,
        data: compose.releaseFile
      })
    ).to.throw();
  });
});
