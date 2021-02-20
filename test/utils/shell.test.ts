import { expect } from "chai";
import fs from "fs";
import { shell, ShellError } from "../../src/utils/shell";

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
    expect(errorMessage).to.include("TIMEOUT");
  });

  it("Show a rich typed error", async () => {
    const cmd = "cat does-not-exist";
    const error: ShellError | null = await shell(cmd)
      .then(() => null)
      .catch(e => e);

    if (!error) throw Error("Command did not throw");

    expect(error.message).to.equal(
      `Command failed: cat does-not-exist
cat: does-not-exist: No such file or directory

stdout: 
stderr: cat: does-not-exist: No such file or directory
`,
      "wrong error.message"
    );

    expect({
      cmd: error.cmd,
      code: error.code,
      stdout: error.stdout,
      stderr: error.stderr
    }).to.deep.equal({
      cmd: "cat does-not-exist",
      code: 1,
      stdout: "",
      stderr: "cat: does-not-exist: No such file or directory\n"
    });
  });

  after(() => {
    fs.unlinkSync(scriptPath);
  });
});
