import { expect } from "chai";
import { shell } from "../../src/utils/shell";

describe("shell utility", () => {

  it("call docker-compose", async () => {
    // Check that the output is correct
    const output = await shell(`docker-compose --version`);
    expect(output).to.be.ok
  });

  it("Execute a command without crashing", async () => {
    // Check that the output is correct
    const output = await shell(`echo hello`);
    expect(output).to.equal("hello");
    // Check that it errors on timeout
    const errorMessage = await shell(`sleep 100`, { timeout: 1 }).catch(
      e => e.message
    );
    expect(errorMessage).to.include("timeout");
  });
});
