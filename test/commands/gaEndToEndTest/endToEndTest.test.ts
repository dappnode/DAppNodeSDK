import { expect } from "chai";
import { gaTestEndToEndHandler } from "../../../src/commands/githubActions/endToEndTest/index.js";
import { testDir, cleanTestDir } from "../../testUtils.js";
import { initHandler } from "../../../src/commands/init.js";

describe.skip("command / gaEndToEndTest", function () {
  this.timeout(120 * 1000);

  before(async () => {
    cleanTestDir();
    await initHandler({ dir: testDir, yes: true, force: true });
  });

  it("should execute end to end tests on a real dappnode environment", async () => {
    await gaTestEndToEndHandler({
      dir: testDir,
      // healthCheckUrl: "http://dappnodesdk.public.dappnode",
      errorLogsTimeout: 30
    });
    expect(true).to.equal(true);
  });
});
