import { expect } from "chai";
import { Compose, PackageImage } from "../../src/types";
import { upstreamImageLabel } from "../../src/params";
import {
  updateComposeImageTags,
  parseComposeUpstreamVersion,
  getComposePackageImages,
  composeDeleteBuildProperties,
  writeCompose,
  readCompose
} from "../../src/utils/compose";
import { cleanTestDir, testDir } from "../testUtils";

describe("util > compose", () => {
  describe("updateComposeImageTags", () => {
    const manifest = {
      name: "mypackage.public.dappnode.eth",
      version: "0.1.0"
    };

    describe("local images", () => {
      it("Should prepare compose with multiple services", () => {
        const compose: Compose = {
          version: "3.4",
          services: {
            backend: { build: ".", image: "" },
            frontend: { build: ".", image: "" }
          }
        };

        const expectedImageTags = [
          "backend.mypackage.public.dappnode.eth:0.1.0",
          "frontend.mypackage.public.dappnode.eth:0.1.0"
        ];
        const expectedImages: PackageImage[] = expectedImageTags.map(
          imageTag => ({ type: "local", imageTag })
        );

        const expectedComposeForBuild: Compose = {
          version: "3.4",
          services: {
            backend: { build: ".", image: expectedImageTags[0] },
            frontend: { build: ".", image: expectedImageTags[1] }
          }
        };

        const composeForBuild = updateComposeImageTags(compose, manifest);
        const images = getComposePackageImages(composeForBuild, manifest);

        expect(images).to.deep.equal(expectedImages);
        expect(composeForBuild).to.deep.equal(expectedComposeForBuild);
      });

      it("Should prepare compose with single service - custom serviceName", () => {
        const compose: Compose = {
          version: "3.4",
          services: {
            mypackage: { build: ".", image: "" }
          }
        };

        const expectedImages: PackageImage[] = [
          {
            type: "local",
            imageTag: "mypackage.mypackage.public.dappnode.eth:0.1.0"
          }
        ];

        const expectedComposeForBuild: Compose = {
          version: "3.4",
          services: {
            mypackage: {
              build: ".",
              image: expectedImages[0].imageTag
            }
          }
        };

        const composeForBuild = updateComposeImageTags(compose, manifest);
        const images = getComposePackageImages(composeForBuild, manifest);

        expect(images).to.deep.equal(expectedImages);
        expect(composeForBuild).to.deep.equal(expectedComposeForBuild);
      });

      it("Should prepare compose with single service", () => {
        const compose: Compose = {
          version: "3.4",
          services: {
            "mypackage.public.dappnode.eth": { build: ".", image: "" }
          }
        };

        const expectedImages: PackageImage[] = [
          { type: "local", imageTag: "mypackage.public.dappnode.eth:0.1.0" }
        ];

        const expectedComposeForBuild: Compose = {
          version: "3.4",
          services: {
            "mypackage.public.dappnode.eth": {
              build: ".",
              image: expectedImages[0].imageTag
            }
          }
        };

        const composeForBuild = updateComposeImageTags(compose, manifest);
        const images = getComposePackageImages(composeForBuild, manifest);

        expect(images).to.deep.equal(expectedImages);
        expect(composeForBuild).to.deep.equal(expectedComposeForBuild);
      });
    });

    describe("external images", () => {
      const compose: Compose = {
        version: "3.4",
        services: {
          backend: { build: "./build", image: "backend" },
          frontend: { image: "nginx:alpine" }
        }
      };

      it("Should edit external image tags", () => {
        const expectedCompose: Compose = {
          version: "3.4",
          services: {
            backend: {
              build: "./build",
              image: "backend.mypackage.public.dappnode.eth:0.1.0"
            },
            frontend: {
              image: "frontend.mypackage.public.dappnode.eth:0.1.0",
              labels: {
                [upstreamImageLabel]: "nginx:alpine"
              }
            }
          }
        };

        const composeEdited = updateComposeImageTags(compose, manifest, {
          editExternalImages: true
        });

        expect(composeEdited).to.deep.equal(expectedCompose);
      });

      it("Should not edit external image tags", () => {
        const expectedCompose: Compose = {
          version: "3.4",
          services: {
            backend: {
              build: "./build",
              image: "backend.mypackage.public.dappnode.eth:0.1.0"
            },
            frontend: {
              image: "nginx:alpine"
            }
          }
        };

        const composeEdited = updateComposeImageTags(compose, manifest);

        expect(composeEdited).to.deep.equal(expectedCompose);
      });
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

    it("Should parse the same upstream version for multi-service", () => {
      const compose: Compose = {
        version: "3.4",
        services: {
          validator: {
            image: "sample-image",
            build: {
              args: {
                UPSTREAM_VERSION: "v1.0.0"
              }
            }
          },
          "beacon-chain": {
            image: "sample-image",
            build: {
              args: {
                UPSTREAM_VERSION: "v1.0.0"
              }
            }
          }
        }
      };

      const upstreamVersion = parseComposeUpstreamVersion(compose);

      expect(upstreamVersion).to.equal("v1.0.0");
    });
  });

  describe("composeDeleteBuildProperties", () => {
    after(() => {
      cleanTestDir();
    });

    it("Should remove all build properties", () => {
      const compose: Compose = {
        version: "3.4",
        services: {
          test1: { image: "test:1", build: "." },
          test2: {
            image: "test:2",
            build: { context: ".", args: { PARAM: "VALUE" } }
          }
        }
      };

      const composeEditedExpected: Compose = {
        version: "3.4",
        services: {
          test1: { image: "test:1" },
          test2: { image: "test:2" }
        }
      };

      writeCompose(compose, { dir: testDir });

      composeDeleteBuildProperties({ dir: testDir });

      const composeEdited = readCompose({ dir: testDir });

      expect(composeEdited).to.deep.equal(composeEditedExpected);
    });
  });
});
