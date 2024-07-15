import { expect } from "chai";
import { generatePackagesProps } from "../../../src/tasks/buildAndUpload/generatePackagesProps.js";
import { cleanTestDir, testDir } from "../../testUtils.js";
import { initHandler } from "../../../src/commands/init/handler.js";
import {
  defaultComposeFileName,
  defaultVariantsDirName,
  defaultVariantsEnvValues,
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

    it("should return a package properties array for a single-variant package", function () {
      const pkgsProps = generatePackagesProps({
        rootDir: testDir,
        variantsDirPath: defaultVariantsDirName,
        variants: null
      });

      expect(pkgsProps).to.be.an("array");
      expect(pkgsProps).to.have.lengthOf(1);

      const pkgProps = pkgsProps[0];

      expect(pkgProps).to.have.all.keys(
        "manifest",
        "manifestFormat",
        "compose",
        "releaseDir",
        "manifestPaths",
        "composePaths",
        "images",
        "architectures",
        "variant"
      );

      // Validate the properties are of correct types or formats
      expect(pkgProps.manifest).to.be.an("object");
      expect(pkgProps.compose).to.be.an("object");
      expect(pkgProps.releaseDir).to.be.a("string");
      expect(pkgProps.composePaths).to.be.an("array");
      expect(pkgProps.images).to.be.an("array");
      expect(pkgProps.architectures).to.be.an("array");

      expect(pkgProps.composePaths).to.deep.include.members([
        {
          composeFileName: defaultComposeFileName,
          dir: testDir
        }
      ]);

      expect(pkgProps.architectures).to.include(defaultArch);

      expect(pkgProps.manifest).to.include.keys(["name", "version"]);
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
      const pkgsProps = generatePackagesProps({
        variants: defaultVariantsEnvValues,
        rootDir: testDir,
        variantsDirPath: path.join(testDir, defaultVariantsDirName)
      });

      expect(pkgsProps).to.be.an("array");
      expect(pkgsProps).to.have.lengthOf(defaultVariantsEnvValues.length);
      expect(pkgsProps.map(pkgProps => pkgProps.variant)).to.deep.equal(defaultVariantsEnvValues);

      // TODO: Continue the test knowing that pkgsProps is an array of objects, not a map anymore

      defaultVariantsEnvValues.forEach((variant, index) => {
        const pkgProps = pkgsProps[index];

        expect(pkgProps).to.be.an("object");
        expect(pkgProps.variant).to.equal(variant);
        expect(pkgProps).to.include.all.keys(
          "manifest",
          "manifestFormat",
          "compose",
          "releaseDir",
          "composePaths",
          "images",
          "architectures"
        );

        // Validate the properties are of correct types or formats
        expect(pkgProps.manifest).to.be.an("object");
        expect(pkgProps.compose).to.be.an("object");
        expect(pkgProps.releaseDir).to.be.a("string");
        expect(pkgProps.composePaths).to.be.an("array");
        expect(pkgProps.images).to.be.an("array");
        expect(pkgProps.architectures).to.be.an("array");

        // Example: Validate specific variant paths
        expect(pkgProps.composePaths).to.deep.include.members([
          {
            composeFileName: defaultComposeFileName,
            dir: testDir
          },
          {
            composeFileName: defaultComposeFileName,
            dir: `${testDir}/${defaultVariantsDirName}/${variant}`
          }
        ]);

        // Assuming we can check details about manifest, compose object structure if known
        expect(pkgProps.manifest).to.include.keys(["name", "version"]);
      });
    });
  });
});
