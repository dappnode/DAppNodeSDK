import { expect } from "chai";
import { isPackageNotRegisteredError } from "../../src/utils/isPackageNotRegisteredError.js";

describe("isPackageNotRegisteredError", () => {
  // Each string is what an APM lookup for an unpublished package actually
  // produced, so the first publish must keep working across ethers versions.
  const notRegistered: { name: string; message: string }[] = [
    {
      name: "toolkit reports no repository",
      message: "Could not resolve name foo.dnp.dappnode.eth: NOREPO"
    },
    {
      name: "ethers v6 before the custom-error decoding",
      message: "Could not resolve name foo.dnp.dappnode.eth"
    },
    {
      name: "current ethers decodes the ENS custom error",
      message: "execution reverted: ResolverNotFound(bytes)"
    }
  ];

  for (const { name, message } of notRegistered) {
    it(`detects an unregistered package: ${name}`, () => {
      expect(isPackageNotRegisteredError(new Error(message))).to.equal(true);
    });
  }

  // A registry problem must never be mistaken for an unpublished package, or
  // publish would silently restart versioning from the manifest.
  const realFailures: { name: string; message: string }[] = [
    { name: "unrelated revert", message: "execution reverted: Unauthorized()" },
    { name: "network failure", message: "could not detect network" },
    { name: "bad response", message: "missing response for request" }
  ];

  for (const { name, message } of realFailures) {
    it(`does not swallow a real failure: ${name}`, () => {
      expect(isPackageNotRegisteredError(new Error(message))).to.equal(false);
    });
  }

  it("tolerates a non-Error value", () => {
    expect(isPackageNotRegisteredError(undefined)).to.equal(false);
    expect(isPackageNotRegisteredError("execution reverted: ResolverNotFound(bytes)")).to.equal(true);
  });
});
