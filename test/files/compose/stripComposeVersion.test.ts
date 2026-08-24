import { expect } from "chai";
import { Compose } from "@dappnode/types";
import { stripComposeVersion } from "../../../src/files/index.js";

describe("files / compose / stripComposeVersion", () => {
  it("Should strip the obsolete top-level version", () => {
    const compose: Compose = {
      version: "3.5",
      services: {
        service: { image: "service:1.0.0" }
      }
    };

    stripComposeVersion(compose);

    expect(compose).to.deep.equal({
      services: {
        service: { image: "service:1.0.0" }
      }
    });
  });
});
