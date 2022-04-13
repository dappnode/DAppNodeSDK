import { expect } from "chai";
import { readCompose } from "../../../src/releaseFiles/compose/compose";
import { validateSchema } from "../../../src/releaseFiles/validateSchema";
import { ReleaseFileType } from "../../../src/types";

describe("validation / Compose", () => {
  const composeDir = "test/validation/compose";

  it("Should read and validate a valid docker-compose file", () => {
    const compose = readCompose({
      dir: composeDir,
      composeFileName: "good-docker-compose.yml"
    });

    validateSchema({ type: ReleaseFileType.compose, data: compose });
  });

  it("Should read and not validate an invalid docker-compose file", () => {
    const compose = readCompose({
      dir: composeDir,
      composeFileName: "bad-docker-compose.yml"
    });
    // expect to throw error
    expect(() =>
      validateSchema({ type: ReleaseFileType.compose, data: compose })
    ).to.throw();
  });
});
