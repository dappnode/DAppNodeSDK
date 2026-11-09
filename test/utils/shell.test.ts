import { expect } from "chai";
import fs from "fs";
import { shell, ShellError } from "../../src/utils/shell.js";

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
      `Command failed (exit 1): cat does-not-exist
cat: does-not-exist: No such file or directory`,
      "wrong error.message"
    );
    expect(error.summary).to.equal(
      "Command failed (exit 1): cat does-not-exist"
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

  it("keeps only the last lines of long output in the message", async () => {
    const error = await shell([
      "sh",
      "-c",
      "for i in $(seq 1 30); do echo line-$i >&2; done; exit 2"
    ]).catch(e => e);
    const lines = error.message.split("\n");
    expect(lines[0]).to.match(/^Command failed \(exit 2\): sh -c /);
    expect(lines[1]).to.equal("... (10 earlier lines omitted)");
    expect(lines.slice(2)).to.deep.equal(
      Array.from({ length: 20 }, (_, i) => `line-${i + 11}`)
    );
    expect(error.stderr.split("\n").filter(Boolean)).to.have.length(30);
  });

  after(() => {
    fs.unlinkSync(scriptPath);
  });
});
