import { expect } from "chai";
import path from "path";
import { testDir, cleanTestDir } from "../testUtils";
import { loadCache, writeToCache, _pruneCache } from "../../src/utils/cache";

describe("util > cache", () => {
  const cacheEntry = ["image:version", "0x00000000"];
  const cachePath = path.join(testDir, "docker-build-cache.json");

  before("Clean testDir", () => cleanTestDir());
  after("Clean testDir", () => cleanTestDir());

  it("Should write to cache and load it", () => {
    writeToCache({ key: cacheEntry[0], value: cacheEntry[1] }, cachePath);
    const cache = loadCache(cachePath);
    expect([...cache]).to.deep.equal([cacheEntry]);
  });

  it("Should prune cache of non-existent image IDs", () => {
    const existingEntry: [string, string] = [
      "dappnodesdk.public.dappnode.eth:0.1.0/sha256:6b74b6ba423e4103a5e9f944842ccaa2c9109a0fd6ebcb3b561c4a031eaae864",
      "5847ce2443f76a6c8ea7a5b597916c66f8df46d1cea1b07579408d5d8b4b5868"
    ];
    const nonExistingEntry: [string, string] = [
      "dappnodesdk.public.dappnode.eth:0.0.7/sha256:9b894a7b52617bff18b156def0f4539aa16902b0645c569c663718991916bbee",
      "7a7087428590f62aab65d55368fb5d0085a30f0d06e5d12e94dee6d7cd99efc8"
    ];
    const cache = new Map([existingEntry, nonExistingEntry]);
    const imageIds = [
      "6b74b6ba423e",
      "4a67065ab84a",
      "d2320140af60",
      "d112c75f4189",
      "cd25b55c48fd",
      "5480cec82e92",
      "f0fca0f58ebd",
      "1be8ef5a787b",
      "87394792902f",
      "26239cf9bb04",
      "914b7cba0231",
      "c8351427733e",
      "6edd24529521",
      "1c96191e65b1",
      "8b215bafea29",
      "01008dc00843",
      "b7ebfbf50133",
      "494089ac8866",
      "6411525f979f",
      "3ed05d600ff2",
      "ad7808c5e928",
      "4cd89b976c3a",
      "e8adc921f57a",
      "c38ac89bb104",
      "c19b39de6895",
      "640d3252d2cb",
      "7bf93c6f2b26",
      "834bfb8de71d",
      "0f2c18cef5d3",
      "18f4bc975732",
      "975176a9c454",
      "018c9d7b792b",
      "78a2ce922f86",
      "b5fc739b191d",
      "bf756fb1ae65",
      "56bc3a1ed035",
      "56bc3a1ed035"
    ];

    const prunedCache = _pruneCache(cache, imageIds);

    expect([...prunedCache]).to.deep.equal([existingEntry]);
  });
});
