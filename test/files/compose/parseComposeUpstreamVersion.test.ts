import { expect } from "chai";
import {
  Compose,
  parseComposeUpstreamVersion
} from "../../../src/files/index.js";

describe("files / compose / parseComposeUpstreamVersion", () => {
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
