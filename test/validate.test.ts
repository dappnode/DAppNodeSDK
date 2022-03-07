import { expect } from "chai";
import { validateManifestSchema } from "../src/utils/validateManifestSchema";

describe("utils / format", () => {
  it("validateManifest chainDriver as string", () => {
    const manifest = {
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
