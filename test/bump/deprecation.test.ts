import { expect } from "chai";
import { printBumpDeprecation } from "../../src/commands/githubActions/bumpUpstream/deprecation.js";
import { getBumpPrBody } from "../../src/commands/githubActions/bumpUpstream/github/getBumpPrBody.js";

describe("bump migration and PR metadata", () => {
  it("logs the deprecation and an Actions warning with both migration paths", () => {
    const lines: string[] = [];
    printBumpDeprecation(line => lines.push(line));
    expect(lines).to.have.length(2);
    expect(lines[1]).to.equal(
      `::warning title=dappnodesdk bump-upstream is deprecated::${lines[0]}`
    );
    expect(lines[0])
      .to.include(
        "dappnode/workflows/.github/workflows/bump-upstream.yml@master"
      )
      .and.to.include("dappnode/workflows/actions/bump-upstream@master");
  });

  it("includes Explorer metadata and the exact Compose pin", () => {
    const value = `v2.0.0@sha256:${"a".repeat(64)}`;
    const body = getBumpPrBody([
      {
        repo: "acme/app",
        arg: "VERSION",
        manifestVersion: "v1.0.0",
        githubVersion: "v2.0.0",
        composeValue: value
      }
    ]);
    expect(body).to.include(`Compose: \`${value}\``);
    expect(body.split("\n")).to.include(
      '<!-- explorer-dashboard: {"kind":"bump"} -->'
    );
  });
});
