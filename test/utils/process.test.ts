import fs from "fs";
import path from "path";
import { expect } from "chai";
import { shell } from "../../src/utils/shell.js";
import { getLocalBranchExists } from "../../src/utils/git.js";
import { isValidRelease } from "../../src/commands/githubActions/bumpUpstream/github/isValidRelease.js";
import {
  executable,
  temporaryDirectory,
  useExecutables
} from "../helpers/fixtures.js";

describe("safe commands and line buffering", () => {
  it("passes metacharacters literally instead of executing them", async () => {
    const value = '$(touch SHOULD_NOT_EXIST);echo unsafe "quoted"';
    const result = await shell([
      process.execPath,
      "-e",
      "process.stdout.write(process.argv[1])",
      value
    ]);
    expect(result).to.equal(value);
    expect(isValidRelease("v1.2.3$(touch${IFS}marker)")).to.equal(false);
  });

  it("never evaluates a branch name while checking whether it exists", async () => {
    const dir = temporaryDirectory();
    const marker = path.join(dir, "marker");
    executable(dir, "git", "process.exit(1);");
    const restore = useExecutables(dir);
    try {
      expect(
        await getLocalBranchExists(`demo$(touch\u0024{IFS}${marker})`)
      ).to.equal(false);
      expect(fs.existsSync(marker)).to.equal(false);
    } finally {
      restore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("assembles partial UTF-8 lines independently on stdout and stderr", async () => {
    const lines: string[] = [];
    await shell(
      [
        process.execPath,
        "-e",
        'process.stdout.write("hel"); process.stderr.write("warn\\n"); setTimeout(() => { process.stdout.write("lo\\nlast"); }, 30);'
      ],
      { onData: line => lines.push(line) }
    );
    expect(lines).to.include("hello").and.include("warn").and.include("last");
    expect(lines).not.to.include("hel");
  });
});
