import { expect } from "chai";
import fs from "fs";
import { shell } from "../../src/utils/shell";

describe("shell utility", () => {
  const scriptPath = "test-script.sh";
  const scriptData = `
#!/bin/bash
sleep .01
echo "hello"
`.trim();

  before("Write test script", () => {
    fs.writeFileSync(scriptPath, scriptData);
    fs.chmodSync(scriptPath, "0755"); // +x
  });

  it("Execute a command without crashing", async () => {
    // Check that the output is correct
    const output = await shell(`sh ${scriptPath}`);
    expect(output).to.equal("hello");
    // Check that it errors on timeout
    const errorMessage = await shell(`sh ${scriptPath}`, { timeout: 1 }).catch(
      e => e.message
    );
    expect(errorMessage).to.include("timed out");
  });

  after(() => {
    fs.unlinkSync(scriptPath);
  });
});
