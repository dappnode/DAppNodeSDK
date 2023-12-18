import { expect } from "chai";
import {
  getPrBody,
  getUpstreamVersionTag,
  isUndesiredRealease,
  VersionToUpdate
} from "../../../src/commands/githubActions/bumpUpstream/format.js";

describe("command / gaBumpUpstream / format", () => {
  describe("single version", () => {
    const versionsToUpdate: VersionToUpdate[] = [
      {
        repoSlug: "ipfs/go-ipfs",
        newVersion: "v0.7.0",
        currentVersion: "v0.6.0"
      }
    ];

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
    const versionsToUpdate: VersionToUpdate[] = [
      {
        repoSlug: "sigp/lighthouse",
        newVersion: "v0.1.4",
        currentVersion: "v0.1.2"
      },
      {
        repoSlug: "prysmaticlabs/prysm",
        newVersion: "v0.1.0-beta.29",
        currentVersion: "v0.1.0-beta.28"
      }
    ];

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
    const versionsToUpdate: VersionToUpdate[] = [
      {
        repoSlug: "sigp/lighthouse",
        newVersion: "v0.1.5",
        currentVersion: "v0.1.2"
      },
      {
        repoSlug: "sigp/lighthouse",
        newVersion: "v0.1.4-rc.0",
        currentVersion: "v0.1.2"
      },
      {
        repoSlug: "sigp/lighthouse",
        newVersion: "v0.1.4-RC.0",
        currentVersion: "v0.1.2"
      },
      {
        repoSlug: "status-im/nimbus-eth2",
        newVersion: "nightly",
        currentVersion: "v23.3.2"
      }
      
    ];

    it("isDesiredRealease", () => {
      expect(isUndesiredRealease(versionsToUpdate[0].newVersion)).equal(
        false
      );
    });
    it("isRealeaseCandidate", () => {
      expect(isUndesiredRealease(versionsToUpdate[1].newVersion)).equal(
        true
      );
    });
    it("isRealeaseCandidate", () => {
      expect(isUndesiredRealease(versionsToUpdate[2].newVersion)).equal(
        true
      );
    });
    it("isNightlyRealease", () => {
      expect(isUndesiredRealease(versionsToUpdate[3].newVersion)).equal(
        true
      );
    });
  });
});
