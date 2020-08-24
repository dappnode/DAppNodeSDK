import { expect } from "chai";
import fs from "fs";
import { Compose } from "../../src/types";
import { testDir, cleanTestDir } from "../testUtils";
import {
  readCompose,
  writeCompose,
  prepareComposeForBuild
} from "../../src/utils/compose";

describe("util > compose", () => {
  describe("prepareComposeForBuild", () => {
    before("Clean test dir", cleanTestDir);
    after("Clean test dir", cleanTestDir);

    it("Should prepare compose with multiple services", () => {
      const name = "mypackage.public.dappnode.eth";
      const version = "0.1.0";
      const compose: Compose = {
        version: "3.4",
        services: {
          backend: {
            image: ""
          },
          frontend: {
            image: ""
          }
        }
      };

      const expectedImageTags = [
        "backend.mypackage.public.dappnode.eth:0.1.0",
        "frontend.mypackage.public.dappnode.eth:0.1.0"
      ];

      const expectedCompose: Compose = {
        version: "3.4",
        services: {
          backend: {
            image: expectedImageTags[0]
          },
          frontend: {
            image: expectedImageTags[1]
          }
        }
      };

      writeCompose(testDir, compose);
      const imageTags = prepareComposeForBuild({ name, version, dir: testDir });

      expect(imageTags).to.deep.equal(expectedImageTags);
      expect(readCompose(testDir)).to.deep.equal(expectedCompose);
    });

    it("Should prepare compose with single service", () => {
      const name = "mypackage.public.dappnode.eth";
      const version = "0.1.0";
      const compose: Compose = {
        version: "3.4",
        services: {
          mypackage: {
            image: ""
          }
        }
      };

      const expectedImageTags = ["mypackage.public.dappnode.eth:0.1.0"];

      const expectedCompose: Compose = {
        version: "3.4",
        services: {
          mypackage: {
            image: expectedImageTags[0]
          }
        }
      };

      writeCompose(testDir, compose);
      const imageTags = prepareComposeForBuild({ name, version, dir: testDir });

      expect(imageTags).to.deep.equal(expectedImageTags);
      expect(readCompose(testDir)).to.deep.equal(expectedCompose);
    });
  });
});
