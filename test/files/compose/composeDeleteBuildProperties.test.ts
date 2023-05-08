import { expect } from "chai";
import {
  composeDeleteBuildProperties,
  readCompose,
  writeCompose
} from "../../../src/files/index.js";
import { cleanTestDir, testDir } from "../../testUtils.js";
import { Compose } from "@dappnode/types";

describe("files / compose / composeDeleteBuildProperties", () => {
  after(() => {
    cleanTestDir();
  });

  it("Should remove all build properties", () => {
    const compose: Compose = {
      version: "3.4",
      services: {
        test1: { image: "test:1", build: "." },
        test2: {
          image: "test:2",
          build: { context: ".", args: { PARAM: "VALUE" } }
        }
      }
    };

    const composeEditedExpected: Compose = {
      version: "3.4",
      services: {
        test1: { image: "test:1" },
        test2: { image: "test:2" }
      }
    };

    writeCompose(compose, { dir: testDir });

    composeDeleteBuildProperties({ dir: testDir });

    const composeEdited = readCompose({ dir: testDir });

    expect(composeEdited).to.deep.equal(composeEditedExpected);
  });
});
