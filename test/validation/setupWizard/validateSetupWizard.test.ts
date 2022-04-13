import { expect } from "chai";
import { readReleaseFile } from "../../../src/releaseFiles/readReleaseFile";
import { validateSchema } from "../../../src/releaseFiles/validateSchema";
import { ReleaseFileType } from "../../../src/types";

describe("utils / validateWizardSchema", () => {
  const setupWizardDir = "test/validation/setupWizard";

  it("Should read and validate a valid setup-wizard file", () => {
    const setupWizard = readReleaseFile(ReleaseFileType.setupWizard, {
      dir: setupWizardDir,
      releaseFileName: "good-setup-wizard.yml"
    });

    validateSchema({
      type: ReleaseFileType.setupWizard,
      data: setupWizard.releaseFile
    });
  });

  it("Should read and not validate an invalid setup-wizard file", () => {
    const setupWizard = readReleaseFile(ReleaseFileType.setupWizard, {
      dir: setupWizardDir,
      releaseFileName: "bad-setup-wizard.yml"
    });

    expect(() =>
      validateSchema({
        type: ReleaseFileType.setupWizard,
        data: setupWizard.releaseFile
      })
    ).to.throw();
  });
});
