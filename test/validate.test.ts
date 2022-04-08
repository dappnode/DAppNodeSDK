import { expect } from "chai";
import { Manifest } from "../src/types";
import { validateManifestSchema } from "../src/utils/validateManifestSchema";
import { validateWizardSchema } from "../src/utils/validateWizardSchema";

describe("utils / validateManifestSchema", () => {
  it("validateManifest chainDriver as string", () => {
    const manifest: Manifest = {
      name: "",
      version: "1.0.0",
      description: "",
      type: "dncore",
      license: "1",
      chain: {
        driver: "ethereum"
      }
    };

    const validManifest = validateManifestSchema(manifest);
    expect(validManifest.valid).to.be.true;
    expect(validManifest.errors).to.be.empty;
  });

  it("validateManifest chainDriver as object", () => {
    const manifest = {
      name: "",
      version: "1.0.0",
      description: "",
      type: "dncore",
      license: "1",
      chain: "ethereum"
    };

    const validManifest = validateManifestSchema(manifest);
    expect(validManifest.valid).to.be.true;
    expect(validManifest.errors).to.be.empty;
  });

  it("throw error validating", () => {
    const manifest = {
      name: "",
      version: "1.0.0",
      description: "",
      type: "dncore",
      license: "1",
      chain: "notAllowed"
    };

    const validManifest = validateManifestSchema(manifest);
    expect(validManifest.valid).to.be.false;
    expect(validManifest.errors).to.not.be.empty;
  });
});

describe("utils / validateWizardSchema", () => {
  it("Should validate setup-wizard", () => {
    const setupWizard: Manifest["setupWizard"] = {
      version: "2",
      fields: [
        {
          id: "payoutAddress,",
          target: {
            type: "environment",
            name: "PAYOUT_ADDRESS",
            service: "service1"
          },
          title: "Payout address",
          description:
            "Address to send **payouts** too. [More info](https://more.info) Supports markdown and multiline",
          secret: true,
          pattern: "^0x[a-fA-F0-9]{40}$",
          patternErrorMessage: "Must be a valid address (0x1fd16a...)",
          enum: ["normal", "archive", "advanced"],
          required: true,
          if: {
            mode: {
              enum: ["advanced"]
            }
          }
        }
      ]
    };

    const validateSetupWizard = validateWizardSchema(setupWizard);
    expect(validateSetupWizard.valid).to.be.true;
    expect(validateSetupWizard.errors).to.be.empty;
  });
});
