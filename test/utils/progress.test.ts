import { expect } from "chai";
import { mock } from "node:test";
import Listr from "listr";
import {
  renderProgress,
  taskLog,
  VerboseRenderer,
  type ProgressTask
} from "../../src/utils/progress.js";
import { shell } from "../../src/utils/shell.js";

function pending(title: string, output: string): ProgressTask {
  return {
    title,
    output,
    subtasks: [],
    isEnabled: () => true,
    isPending: () => true,
    isCompleted: () => false,
    isSkipped: () => false,
    hasFailed: () => false
  };
}

describe("build progress preview", () => {
  afterEach(() => mock.restoreAll());

  it("reports each log line once, as its own output update", () => {
    const task: { output?: string } = {};
    const write = taskLog(task);
    write("layer 1");
    expect(task.output).to.equal("layer 1");
    write("\u001b[32mlayer 2\u001b[0m");
    expect(task.output).to.equal("layer 2");
  });

  it("shows the last few lines of a pending task from the renderer history", () => {
    const task = pending("Build mainnet · linux/arm64", "layer 5");
    const history = new WeakMap<object, string[]>([
      [task, ["layer 2", "layer 3", "layer 4", "layer 5"]]
    ]);
    const lines = renderProgress([task], "⠋", 0, history);
    expect(lines.join("\n")).to.include("layer 2").and.include("layer 5");
    expect(lines[0]).to.include("mainnet").and.include("arm64");
  });

  it("does not repeat the error under a failed task", () => {
    const failed = {
      ...pending("Build docker image", "Command failed (exit 1): docker build"),
      isPending: () => false,
      hasFailed: () => true
    };
    const lines = renderProgress([failed], "⠋", 0, new WeakMap());
    expect(lines).to.deep.equal(["✖ Build docker image"]);
  });

  it("keeps the active upload/pinning stage visible without future task clutter", () => {
    const task = pending(
      "Upload mainnet",
      "Upload sent · waiting for pinning confirmation..."
    );
    const future = { ...pending("Future stage", ""), isPending: () => false };
    const lines = renderProgress([task, future]);
    expect(lines.join("\n")).to.include("waiting for pinning confirmation");
    expect(lines.join("\n")).not.to.include("Future stage");
  });

  it("logs every streamed line once in verbose mode and leaves the error to the CLI", async () => {
    const logged: string[] = [];
    mock.method(console, "log", (line: string) => logged.push(line));
    const error = await new Listr(
      [
        {
          title: "Build docker image",
          task: (_, task) =>
            shell(
              [
                "sh",
                "-c",
                "for i in 1 2 3 4 5 6; do echo step-$i; done; exit 3"
              ],
              { onData: taskLog(task) }
            )
        }
      ],
      { renderer: VerboseRenderer }
    )
      .run()
      .catch(error => error);
    mock.restoreAll();
    expect(error.summary).to.equal(
      "Command failed (exit 3): sh -c for i in 1 2 3 4 5 6; do echo step-$i; done; exit 3"
    );
    for (const step of [1, 2, 3, 4, 5, 6])
      expect(
        logged.filter(line => line.includes(`step-${step}`)),
        `step-${step}`
      ).to.have.length(1);
    expect(logged.some(line => line.includes("Command failed"))).to.equal(
      false
    );
    expect(logged.some(line => line.includes("[failed]"))).to.equal(true);
  });
});
