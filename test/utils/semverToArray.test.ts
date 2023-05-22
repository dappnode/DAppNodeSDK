import { expect } from "chai";
import { semverToArray } from "../../src/utils/semverToArray.js";

describe("semver to array conversions", () => {
  const semver = "0.1.5";
  const versionArray = ["0", "1", "5"];

  it("should convert a semver version to array", () => {
    expect(semverToArray(semver)).to.deep.equal(versionArray);
  });
});
