import { expect } from "chai";
import { buildVariantMap } from "../../../src/tasks/buildAndUpload/buildVariantMap.js";
import { cleanTestDir, testDir } from "../../testUtils.js";
import { initHandler } from "../../../src/commands/init/handler.js";
import {
  defaultComposeFileName,
  defaultVariantsDirName,
  defaultVariantsEnvValues,
  singleVariantName
} from "../../../src/params.js";
import { defaultArch } from "@dappnode/types";
import path from "path";

describe("buildVariantMap", function () {
  before("Clean testDir", () => cleanTestDir());
  after("Clean testDir", () => cleanTestDir());

  context("without variants provided", function () {
    before("Init repo", async () => {
      await initHandler({
        dir: testDir,
        force: true,
        yes: true,
        use_variants: false
      });
    });

    it("should return a map with a single variant", function () {
      const result = buildVariantMap({
        rootDir: testDir,
        variantsDirPath: defaultVariantsDirName,
        variants: null
      });

      expect(result).to.have.all.keys(singleVariantName);
      const defaultVariant = result[singleVariantName];

      expect(defaultVariant).to.have.all.keys(
        "manifest",
        "manifestFormat",
        "compose",
        "releaseDir",
        "composePaths",
        "images",
        "architectures"
      );

      // Validate the properties are of correct types or formats
      expect(defaultVariant.manifest).to.be.an("object");
      expect(defaultVariant.compose).to.be.an("object");
      expect(defaultVariant.releaseDir).to.be.a("string");
      expect(defaultVariant.composePaths).to.be.an("array");
      expect(defaultVariant.images).to.be.an("array");
      expect(defaultVariant.architectures).to.be.an("array");

      expect(defaultVariant.composePaths).to.include.members([
        `${testDir}/${defaultComposeFileName}`
      ]);

      expect(defaultVariant.architectures).to.include(defaultArch);

      expect(defaultVariant.manifest).to.include.keys(["name", "version"]);
    });
  });

  context("with variants provided", function () {
    before("Init repo", async () => {
      await initHandler({
        dir: testDir,
        force: true,
        yes: true,
        use_variants: true
      });
    });

    it("should return a map including all specified variants", function () {
      const result = buildVariantMap({
        variants: defaultVariantsEnvValues,
        rootDir: testDir,
        variantsDirPath: path.join(testDir, defaultVariantsDirName)
      });

      // Verify
      expect(result).to.have.all.keys(defaultVariantsEnvValues);
      defaultVariantsEnvValues.forEach(variant => {
        expect(result[variant]).to.be.an("object");
        expect(result[variant]).to.include.all.keys(
          "manifest",
          "manifestFormat",
          "compose",
          "releaseDir",
          "composePaths",
          "images",
          "architectures"
        );

        // Validate the properties are of correct types or formats
        expect(result[variant].manifest).to.be.an("object");
        expect(result[variant].compose).to.be.an("object");
        expect(result[variant].releaseDir).to.be.a("string");
        expect(result[variant].composePaths).to.be.an("array");
        expect(result[variant].images).to.be.an("array");
        expect(result[variant].architectures).to.be.an("array");

        // Example: Validate specific variant paths
        expect(result[variant].composePaths).to.include.members([
          `${testDir}/${defaultComposeFileName}`,
          `${testDir}/${defaultVariantsDirName}/${variant}/${defaultComposeFileName}`
        ]);

        // Assuming we can check details about manifest, compose object structure if known
        expect(result[variant].manifest).to.include.keys(["name", "version"]);
      });
    });
  });
});
