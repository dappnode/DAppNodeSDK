import { expect } from "chai";
import { Compose } from "../../src/types";
import { testDir, cleanTestDir } from "../testUtils";
import {
  readCompose,
  writeCompose,
  prepareComposeForBuild,
  parseComposeUpstreamVersion
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

  describe("parseComposeUpstreamVersion", () => {
    it("Should parse multiple upstream versions", () => {
      const compose: Compose = {
        version: "3.4",
        services: {
          validator: {
            image: "sample-image",
            build: {
              args: {
                UPSTREAM_VERSION_PRYSM: "v1.0.0-alpha.25",
                UPSTREAM_VERSION_LIGHTHOUSE: "v0.2.9"
              }
            }
          }
        }
      };

      const upstreamVersion = parseComposeUpstreamVersion(compose);

      expect(upstreamVersion).to.equal(
        "Prysm: v1.0.0-alpha.25, Lighthouse: v0.2.9"
      );
    });
  });
});
