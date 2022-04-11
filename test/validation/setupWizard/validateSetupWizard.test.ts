import { expect } from "chai";
import { validateSetupWizard } from "../../../src/validation/setupWizard/validateSetupWizard";
import { readSetupWizardIfExists } from "../../../src/validation/setupWizard/setupWizard";

describe("utils / validateWizardSchema", () => {
  const setupWizardDir = "test/validation/setupWizard";

  it("Should read and validate a valid setup-wizard file", () => {
    const setupWizard = readSetupWizardIfExists({
      dir: setupWizardDir,
      setupWizardFileName: "good-setup-wizard.yml"
    });
    if (!setupWizard) throw Error("No setup-wizard file found for tests");
    validateSetupWizard(setupWizard.setupWizard);
  });

  it("Should read and not validate an invalid setup-wizard file", () => {
    const setupWizard = readSetupWizardIfExists({
      dir: setupWizardDir,
      setupWizardFileName: "bad-setup-wizard.yml"
    });
    if (!setupWizard) throw Error("No setup-wizard file found for tests");
    expect(() => validateSetupWizard(setupWizard.setupWizard)).to.throw();
  });
});
