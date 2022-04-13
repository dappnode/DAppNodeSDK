import { expect } from "chai";
import { readReleaseFile } from "../../../src/releaseFiles/readReleaseFile";
import { ReleaseFileType } from "../../../src/releaseFiles/types";
import { validateSchema } from "../../../src/releaseFiles/validateSchema";
import { validateDappnodeCompose } from "../../../src/releaseFiles/compose/validateDappnodeCompose";

describe("validation / Compose", () => {
  const composeDir = "test/validation/compose";

  it("Should read and validate a valid docker-compose file", () => {
    const compose = readReleaseFile(ReleaseFileType.compose, {
      dir: composeDir,
      releaseFileName: "good-docker-compose.yml"
    });

    validateSchema({
      type: ReleaseFileType.compose,
      data: compose.data
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
        data: compose.data
      })
    ).to.throw();
  });

  it("Should read and not validate an invalid docker-compose file with a host volume mounted", () => {
    const compose = readReleaseFile(ReleaseFileType.compose, {
      dir: composeDir,
      releaseFileName: "bad-docker-compose.yml"
    });

    const manifest = readReleaseFile(ReleaseFileType.manifest, {
      dir: "test/validation/manifest",
      releaseFileName: "good-dappnode_package.json"
    });

    // expect to throw error
    expect(() =>
      validateDappnodeCompose({
        composeUnsafe: compose.data,
        manifest: manifest.data
      })
    ).to.throw();
  });
});
