import { expect } from "chai";
import { Manifest } from "../src/releaseFiles/manifest/types";
import { validateReleaseFile } from "../src/schemaValidation/validateSchema";

describe("utils / format", () => {
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

    const validManifest = validateReleaseFile(manifest);
    expect(validManifest.valid).to.be.true;
    expect(validManifest.errors).to.be.empty;
  });

  it("validateManifest chainDriver as object", () => {
    const manifest: Manifest = {
      name: "",
      version: "1.0.0",
      description: "",
      type: "dncore",
      license: "1",
      chain: "ethereum"
    };

    const validManifest = validateReleaseFile(manifest);
    expect(validManifest.valid).to.be.true;
    expect(validManifest.errors).to.be.empty;
  });

  it("throw error validating", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manifest: any = {
      name: "",
      version: "1.0.0",
      description: "",
      type: "dncore",
      license: "1",
      chain: "notAllowed"
    };

    const validManifest = validateReleaseFile(manifest);
    expect(validManifest.valid).to.be.false;
    expect(validManifest.errors).to.not.be.empty;
  });
});
