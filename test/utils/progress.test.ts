import { expect } from "chai";
import {
  renderProgress,
  taskLog,
  type ProgressTask
} from "../../src/utils/progress.js";

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
  it("retains complete recent log lines and renders them together", () => {
    const task = pending("Build mainnet · linux/arm64", "");
    const write = taskLog(task as { output: string });
    for (let index = 0; index < 6; index++) write(`layer ${index}`);
    const lines = renderProgress([task]);
    expect(lines.join("\n")).to.include("layer 2").and.include("layer 5");
    expect(lines.join("\n")).not.to.include("layer 1");
    expect(lines[0]).to.include("mainnet").and.include("arm64");
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
});
