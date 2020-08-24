import { expect } from "chai";
import path from "path";
import { testDir, cleanTestDir } from "../testUtils";
import { loadCache, writeCache } from "../../src/utils/cache";

describe("util > cache", () => {
  const cacheEntry = ["image:version", "0x00000000"];
  const cachePath = path.join(testDir, "docker-build-cache.json");

  before("Clean testDir", cleanTestDir);
  after("Clean testDir", cleanTestDir);

  it("should write to cache and load it", () => {
    writeCache({ key: cacheEntry[0], value: cacheEntry[1] }, cachePath);
    const cache = loadCache(cachePath);
    expect([...cache]).to.deep.equal([cacheEntry]);
  });
});
