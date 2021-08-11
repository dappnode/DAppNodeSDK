import { expect } from "chai";
import { isGitUserEmailSet } from "../../src/utils/isGitUserSet";

describe("Test group 1", () => {
  //solo en ci

  it("Example", () => {
    expect(2 + 3).to.equal(5);
  });

  if (process.env.ci) {
    describe.skip("Executed only in CI", () => {
      it("Test 1: a git user exists, it should be true", () => {
        expect(isGitUserEmailSet()).to.equal(true);
      });
    });
  }

  if (process.env.ci) {
    describe.skip("Executed only in CI", () => {
      it("Test 2: a git user exists, it should be true", () => {
        expect(isGitUserEmailSet()).to.equal(true);
      });
    });
  }
});
