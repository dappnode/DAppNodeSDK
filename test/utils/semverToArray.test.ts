import { expect } from "chai";
import { semverToArray } from "../../src/utils/semverToArray";
import { arrayToSemver } from "../../src/utils/arrayToSemver";

describe("semver to array conversions", () => {
  const semver = "0.1.5";
  const versionArray = ["0", "1", "5"];

  it("should convert a semver version to array", () => {
    expect(semverToArray(semver)).to.deep.equal(versionArray);
  });

  it("should convert a version array to semver", () => {
    expect(arrayToSemver(versionArray)).to.equal(semver);
  });
});
