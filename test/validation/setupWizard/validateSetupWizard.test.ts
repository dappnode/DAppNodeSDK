import { expect } from "chai";
import { validateSchema } from "../../../src/releaseFiles/validateSchema";
import { readSetupWizardIfExists } from "../../../src/releaseFiles/setupWizard/setupWizard";
import { ReleaseFileType } from "../../../src/types";

describe("utils / validateWizardSchema", () => {
  const setupWizardDir = "test/validation/setupWizard";

  it("Should read and validate a valid setup-wizard file", () => {
    const setupWizard = readSetupWizardIfExists({
      dir: setupWizardDir,
      setupWizardFileName: "good-setup-wizard.yml"
    });
    if (!setupWizard) throw Error("No setup-wizard file found for tests");
    validateSchema({
      type: ReleaseFileType.setupWizard,
      data: setupWizard.setupWizard
    });
  });

  it("Should read and not validate an invalid setup-wizard file", () => {
    const setupWizard = readSetupWizardIfExists({
      dir: setupWizardDir,
      setupWizardFileName: "bad-setup-wizard.yml"
    });
    if (!setupWizard) throw Error("No setup-wizard file found for tests");
    expect(() =>
      validateSchema({
        type: ReleaseFileType.setupWizard,
        data: setupWizard.setupWizard
      })
    ).to.throw();
  });
});
