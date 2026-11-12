import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";
import {
  extractImageSource,
  findImageSource,
  renderDockerTag
} from "../../src/bump/dockerfile.js";
import { temporaryDirectory } from "../helpers/fixtures.js";

describe("bump / dockerfile", () => {
  describe("extractImageSource", () => {
    it("expands indirect args from their static defaults", () => {
      const dockerfile = [
        "ARG BASE_IMAGE=statusim/nimbus-eth2",
        "ARG ARCH=multiarch",
        "ARG BASE_TAG=${ARCH}-${VERSION}",
        "FROM --platform=$TARGETPLATFORM ${BASE_IMAGE}:${BASE_TAG} AS base"
      ].join("\n");

      const source = extractImageSource(dockerfile, "VERSION");

      expect(source).to.deep.equal({
        image: "statusim/nimbus-eth2",
        template: "multiarch-{version}"
      });
      expect(renderDockerTag(source!, "v26.10.0")).to.equal(
        "multiarch-v26.10.0"
      );
    });

    it("keeps a registry port in the image name", () => {
      expect(
        extractImageSource("FROM host:5000/org/app:$VERSION", "VERSION")
      ).to.deep.equal({ image: "host:5000/org/app", template: "{version}" });
    });

    it("supports prefix removal", () => {
      const source = extractImageSource("FROM app:${VERSION#v}", "VERSION");

      expect(source).to.deep.equal({ image: "app", template: "{version#v}" });
      expect(renderDockerTag(source!, "v1.2.3")).to.equal("1.2.3");
    });

    it("returns null when no FROM tag uses the arg", () => {
      expect(
        extractImageSource(
          "FROM node:22\nRUN npm install app@${VERSION}",
          "VERSION"
        )
      ).to.equal(null);
      expect(extractImageSource("FROM app:$VERSION_EXTRA", "VERSION")).to.equal(
        null
      );
    });
  });

  describe("findImageSource", () => {
    let dir: string;

    beforeEach(() => {
      dir = temporaryDirectory();
      fs.mkdirSync(path.join(dir, "build"));
      fs.writeFileSync(
        path.join(dir, "build", "custom.dockerfile"),
        "FROM org/app:$VERSION\n"
      );
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    for (const args of [{ VERSION: "1" }, ["VERSION=1"]]) {
      it(`reads the Dockerfile of the service declaring the arg (${JSON.stringify(
        args
      )})`, () => {
        const compose = {
          services: {
            unrelated: { build: "." },
            app: {
              build: { context: "build", dockerfile: "custom.dockerfile", args }
            }
          }
        };

        expect(findImageSource(dir, compose, "VERSION")).to.deep.equal({
          image: "org/app",
          template: "{version}"
        });
      });
    }
  });
});
