import { expect } from "chai";
import fs from "fs";
import { loadCache, writeCache } from "../../src/utils/cache";
import { cachePath } from "../../src/params";

describe("semver to array conversions", () => {
  const cacheEntry = ["image:version", "0x00000000"];

  before("Clear cahce", () => fs.unlinkSync(cachePath));
  after("Clear cahce", () => fs.unlinkSync(cachePath));

  it("should write to cache and load it", () => {
    writeCache({ key: cacheEntry[0], value: cacheEntry[1] });
    const cache = loadCache();
    expect([...cache]).to.deep.equal([cacheEntry]);
  });
});
