import { expect } from "chai";
import { printBumpDeprecation } from "../../../src/commands/githubActions/bumpUpstream/deprecation.js";

describe("command / gaBumpUpstream / deprecation", () => {
  it("logs the notice and an Actions warning with both migration paths", () => {
    const lines: string[] = [];
    printBumpDeprecation(line => lines.push(line));

    expect(lines).to.have.length(2);
    expect(lines[0])
      .to.include(
        "dappnode/workflows/.github/workflows/bump-upstream.yml@master"
      )
      .and.to.include("dappnode/workflows/actions/bump-upstream@master");
    expect(lines[1]).to.equal(
      `::warning title=dappnodesdk bump-upstream is deprecated::${lines[0]}`
    );
  });
});
