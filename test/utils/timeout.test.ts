import { expect } from "chai";
import { parseTimeout } from "../../src/utils/timeout.js";

describe("parseTimeout", () => {
  it("parses human-readable durations", () => {
    expect(parseTimeout("20min")).to.equal(20 * 60 * 1000);
    expect(parseTimeout("1h")).to.equal(60 * 60 * 1000);
  });

  it("treats a bare integer string as seconds, as documented by `--timeout 5000`", () => {
    expect(parseTimeout("5000")).to.equal(5000 * 1000);
  });

  it("passes numeric milliseconds through, with 0 meaning no timeout", () => {
    expect(parseTimeout(5000)).to.equal(5000);
    expect(parseTimeout(0)).to.equal(0);
  });

  it("defaults when unset and rejects nonsense", () => {
    expect(parseTimeout(undefined)).to.equal(60 * 60 * 1000);
    expect(parseTimeout("")).to.equal(60 * 60 * 1000);
    expect(() => parseTimeout("0")).to.throw("Invalid timeout");
    expect(() => parseTimeout(-1)).to.throw("Invalid timeout");
    expect(() => parseTimeout("abc")).to.throw();
  });
});
