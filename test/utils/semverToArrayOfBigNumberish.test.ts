import { expect } from "chai";
import { semverToArrayOfBigNumberish } from "../../src/utils/semverToArrayOfBigNumberish.js";

describe("semver to array conversions", () => {
  const semver = "0.1.5";
  const versionArray = [0, 1, 5];

  it("should convert a semver version to array", () => {
    expect(semverToArrayOfBigNumberish(semver)).to.deep.equal(versionArray);
  });
});
