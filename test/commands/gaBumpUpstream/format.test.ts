import { expect } from "chai";
import {
  getPrBody,
  getUpstreamVersionTag,
  isValidRelease,
} from "../../../src/commands/githubActions/bumpUpstream/git.js";
import { ComposeVersionsToUpdate } from "../../../src/commands/githubActions/bumpUpstream/types.js";

describe("command / gaBumpUpstream / format", () => {
  describe("single version", () => {
    const versionsToUpdate: ComposeVersionsToUpdate = {
      "ipfs/go-ipfs": {
        newVersion: "v0.7.0",
        currentVersion: "v0.6.0"
      }

    };

    it("getUpstreamVersionTag", () => {
      const upstreamVersion = getUpstreamVersionTag(versionsToUpdate);
      expect(upstreamVersion).to.equal("v0.7.0");
    });

    it("getPrBody", () => {
      const upstreamVersion = getPrBody(versionsToUpdate);
      expect(upstreamVersion).to.equal(`Bumps upstream version

- [ipfs/go-ipfs](https://github.com/ipfs/go-ipfs) from v0.6.0 to [v0.7.0](https://github.com/ipfs/go-ipfs/releases/tag/v0.7.0)`);
    });
  });

  describe("multiple version", () => {
    const versionsToUpdate: ComposeVersionsToUpdate = {
      "sigp/lighthouse": {
        newVersion: "v0.1.4",
        currentVersion: "v0.1.2"
      },
      "prysmaticlabs/prysm": {
        newVersion: "v0.1.0-beta.29",
        currentVersion: "v0.1.0-beta.28"
      }

    };

    it("getUpstreamVersionTag", () => {
      const upstreamVersion = getUpstreamVersionTag(versionsToUpdate);
      expect(upstreamVersion).to.equal(
        "sigp/lighthouse@v0.1.4, prysmaticlabs/prysm@v0.1.0-beta.29"
      );
    });

    it("getPrBody", () => {
      const upstreamVersion = getPrBody(versionsToUpdate);
      expect(upstreamVersion).to.equal(`Bumps upstream version

- [sigp/lighthouse](https://github.com/sigp/lighthouse) from v0.1.2 to [v0.1.4](https://github.com/sigp/lighthouse/releases/tag/v0.1.4)
- [prysmaticlabs/prysm](https://github.com/prysmaticlabs/prysm) from v0.1.0-beta.28 to [v0.1.0-beta.29](https://github.com/prysmaticlabs/prysm/releases/tag/v0.1.0-beta.29)`);
    });
  });

  describe("checkDesiredRealease", () => {
    const correctVersionsToUpdate: ComposeVersionsToUpdate = {
      "sigp/lighthouse": {
        newVersion: "v0.1.5",
        currentVersion: "v0.1.2"
      },
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

    Object.entries(wrongVersionsToUpdate).forEach(([repoSlug, { newVersion }]) => {
      it(`isUndesiredRelease ${repoSlug} ${newVersion}`, () => {
        expect(isValidRelease(newVersion)).to.equal(false);
      });
    });

    Object.entries(correctVersionsToUpdate).forEach(([repoSlug, { newVersion }]) => {
      it(`isUndesiredRelease ${repoSlug} ${newVersion}`, () => {
        expect(isValidRelease(newVersion)).to.equal(true);
      });
    });
  });
});
