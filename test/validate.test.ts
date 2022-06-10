import { expect } from "chai";
import { Manifest } from "../src/releaseFiles/manifest/types";
import { validateManifestSchema } from "../src/schemaValidation/validateSchema";

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

    expect(() => validateManifestSchema(manifest)).to.not.throw();
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

    expect(() => validateManifestSchema(manifest)).to.not.throw();
  });

  it("throw error validating", () => {
    // Override chain property with invalid valid to test schema
    const manifest: Omit<Manifest, "chain"> & { chain: string } = {
      name: "",
      version: "1.0.0",
      description: "",
      type: "dncore",
      license: "1",
      chain: "notAllowed"
    };

    expect(() => validateManifestSchema(manifest as Manifest)).to.throw();
  });
});
