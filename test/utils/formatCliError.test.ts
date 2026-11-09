import { expect } from "chai";
import { stripVTControlCharacters } from "util";
import { formatCliError } from "../../src/utils/formatCliError.js";
import { shell } from "../../src/utils/shell.js";

const plain = (text: string) => stripVTControlCharacters(text);

describe("CLI error output", () => {
  const failing = (onData?: (line: string) => void) =>
    shell(["sh", "-c", "echo building; echo 'ERROR: boom' >&2; exit 1"], {
      onData
    }).catch(e => e);

  it("prints a failed command once, with the end of its output", async () => {
    const output = plain(
      formatCliError(await failing(), { outputStreamed: false })
    );
    expect(output).to.equal(
      "✖ Command failed (exit 1): sh -c echo building; echo 'ERROR: boom' >&2; exit 1\n  ERROR: boom"
    );
  });

  it("prints only the summary when the log was already streamed", async () => {
    const error = await failing(() => {});
    expect(plain(formatCliError(error, { outputStreamed: true }))).to.equal(
      "✖ Command failed (exit 1): sh -c echo building; echo 'ERROR: boom' >&2; exit 1"
    );
    // The terminal renderer only previews a few lines, so the output tail is still shown there.
    expect(plain(formatCliError(error, { outputStreamed: false }))).to.include(
      "ERROR: boom"
    );
  });

  it("prints other errors by message, and the stack only with --debug", () => {
    const error = new Error("Invalid compose:\ninvalid containerPort: 70007");
    expect(plain(formatCliError(error, { outputStreamed: false }))).to.equal(
      "✖ Invalid compose:\n  invalid containerPort: 70007"
    );
    const debugOutput = plain(
      formatCliError(error, { debug: true, outputStreamed: false })
    );
    expect(debugOutput).to.include("    at ");
    // The message is not repeated through the stack header.
    expect(debugOutput.match(/invalid containerPort/g)).to.have.length(1);
  });
});
