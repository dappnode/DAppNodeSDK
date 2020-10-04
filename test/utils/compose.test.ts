import { expect } from "chai";
import { Compose } from "../../src/types";
import {
  updateComposeImageTags,
  parseComposeUpstreamVersion,
  getComposeImageTags
} from "../../src/utils/compose";

describe("util > compose", () => {
  describe("updateComposeImageTags", () => {
    it("Should prepare compose with multiple services", () => {
      const name = "mypackage.public.dappnode.eth";
      const version = "0.1.0";
      const compose: Compose = {
        version: "3.4",
        services: {
          backend: {
            build: ".",
            image: ""
          },
          frontend: {
            build: ".",
            image: ""
          }
        }
      };

      const expectedImageTags = [
        "backend.mypackage.public.dappnode.eth:0.1.0",
        "frontend.mypackage.public.dappnode.eth:0.1.0"
      ];

      const expectedComposeForBuild: Compose = {
        version: "3.4",
        services: {
          backend: {
            build: ".",
            image: expectedImageTags[0]
          },
          frontend: {
            build: ".",
            image: expectedImageTags[1]
          }
        }
      };

      const composeForBuild = updateComposeImageTags(compose, {
        name,
        version
      });
      const imageTags = getComposeImageTags(composeForBuild);

      expect(imageTags).to.deep.equal(expectedImageTags);
      expect(composeForBuild).to.deep.equal(expectedComposeForBuild);
    });

    it("Should prepare compose with single service", () => {
      const name = "mypackage.public.dappnode.eth";
      const version = "0.1.0";
      const compose: Compose = {
        version: "3.4",
        services: {
          mypackage: {
            build: ".",
            image: ""
          }
        }
      };

      const expectedImageTags = ["mypackage.public.dappnode.eth:0.1.0"];

      const expectedComposeForBuild: Compose = {
        version: "3.4",
        services: {
          mypackage: {
            build: ".",
            image: expectedImageTags[0]
          }
        }
      };

      const composeForBuild = updateComposeImageTags(compose, {
        name,
        version
      });
      const imageTags = getComposeImageTags(composeForBuild);

      expect(imageTags).to.deep.equal(expectedImageTags);
      expect(composeForBuild).to.deep.equal(expectedComposeForBuild);
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
