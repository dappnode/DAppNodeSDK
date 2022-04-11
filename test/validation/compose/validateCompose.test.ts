import { expect } from "chai";
import { readCompose } from "../../../src/validation/compose/compose";
import { validateCompose } from "../../../src/validation/compose/validateCompose";

describe("validation / Compose", () => {
  const composeDir = "test/validation/compose";

  it("Should read and validate a valid docker-compose file", () => {
    const compose = readCompose({
      dir: composeDir,
      composeFileName: "good-docker-compose.yml"
    });

    validateCompose(compose);
  });

  it("Should read and not validate an invalid docker-compose file", () => {
    const compose = readCompose({
      dir: composeDir,
      composeFileName: "bad-docker-compose.yml"
    });
    // expect to throw error
    expect(() => validateCompose(compose)).to.throw();
  });
});
