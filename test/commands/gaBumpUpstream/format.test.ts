import { expect } from "chai";
import {
  getBumpPrBody,
  isValidRelease
} from "../../../src/commands/githubActions/bumpUpstream/github/index.js";
import {
  ComposeVersionsToUpdate,
  UpstreamSettings
} from "../../../src/commands/githubActions/bumpUpstream/types.js";

describe("command / gaBumpUpstream / format", () => {
  describe("single version", () => {
    const versionsToUpdate: UpstreamSettings[] = [
      {
        repo: "ipfs/go-ipfs",
        arg: "v0.7.0",
        manifestVersion: "v0.6.0",
        githubVersion: "v0.7.0"
      }
    ];

    it("getPrBody", () => {
      const upstreamVersion = getBumpPrBody(versionsToUpdate);
      expect(upstreamVersion).to.equal(`Bumps upstream version

- [ipfs/go-ipfs](https://github.com/ipfs/go-ipfs) from v0.6.0 to [v0.7.0](https://github.com/ipfs/go-ipfs/releases/tag/v0.7.0)`);
    });
  });

  describe("multiple version", () => {
    const versionsToUpdate: UpstreamSettings[] = [
      {
        repo: "sigp/lighthouse",
        arg: "v0.1.4",
        manifestVersion: "v0.1.2",
        githubVersion: "v0.1.4"
      },
      {
        repo: "prysmaticlabs/prysm",
        arg: "v0.1.0-beta.29",
        manifestVersion: "v0.1.0-beta.28",
        githubVersion: "v0.1.0-beta.29"
      }
    ];

    it("getPrBody", () => {
      const upstreamVersion = getBumpPrBody(versionsToUpdate);
      expect(upstreamVersion).to.equal(`Bumps upstream version

- [sigp/lighthouse](https://github.com/sigp/lighthouse) from v0.1.2 to [v0.1.4](https://github.com/sigp/lighthouse/releases/tag/v0.1.4)
- [prysmaticlabs/prysm](https://github.com/prysmaticlabs/prysm) from v0.1.0-beta.28 to [v0.1.0-beta.29](https://github.com/prysmaticlabs/prysm/releases/tag/v0.1.0-beta.29)`);
    });
  });

  describe("Check valid releases", () => {
    const correctVersionsToUpdate: ComposeVersionsToUpdate = {
      "sigp/lighthouse": {
        newVersion: "v0.1.5",
        currentVersion: "v0.1.2"
      }
    };

    const wrongVersionsToUpdate: ComposeVersionsToUpdate = {
      "ipfs/kubo": {
        newVersion: "v0.27.0-rc1",
        currentVersion: "v0.1.2"
      },
      "status-im/nimbus-eth2": {
        newVersion: "nightly",
        currentVersion: "v23.3.2"
      },
      "prysmaticlabs/prysm": {
        newVersion: "v0.1.0-rc.0",
        currentVersion: "v0.1.0"
      },
      "ledgerwatch/erigon": {
        newVersion: "v0.1.0-RC.0",
        currentVersion: "v0.1.0"
      }
    };

    Object.entries(wrongVersionsToUpdate).forEach(
      ([repoSlug, { newVersion }]) => {
        it(`Release ${repoSlug} ${newVersion} is invalid`, () => {
          expect(isValidRelease(newVersion)).to.equal(false);
        });
      }
    );

    Object.entries(correctVersionsToUpdate).forEach(
      ([repoSlug, { newVersion }]) => {
        it(`Release ${repoSlug} ${newVersion} is valid`, () => {
          expect(isValidRelease(newVersion)).to.equal(true);
        });
      }
    );
  });
});
