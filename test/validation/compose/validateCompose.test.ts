import { expect } from "chai";
import { readReleaseFile } from "../../../src/releaseFiles/readReleaseFile";
import { ReleaseFileType } from "../../../src/releaseFiles/types";
import { validateSchema } from "../../../src/releaseFiles/validateSchema";

describe.only("validation / Compose", () => {
  const composeDir = "test/validation/compose";

  it.only("Should read and validate a valid docker-compose file", () => {
    const compose = readReleaseFile(ReleaseFileType.compose, {
      dir: composeDir,
      releaseFileName: "good-docker-compose.yml"
    });

    console.log(compose.releaseFile.services);

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
