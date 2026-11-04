import { createLogUpdate } from "log-update";
import wrapAnsi from "wrap-ansi";
import { stripVTControlCharacters } from "util";
import type Listr from "listr";

export interface ProgressTask {
  title: string;
  output?: string;
  subtasks: readonly ProgressTask[];
  isEnabled(): boolean;
  isPending(): boolean;
  isCompleted(): boolean;
  isSkipped(): boolean;
  hasFailed(): boolean;
}

/** Keep a useful preview while verbose renderers still receive every complete line. */
export function taskLog(task: { output: string }): (line: string) => void {
  const lines: string[] = [];
  return line => {
    lines.push(stripVTControlCharacters(line));
    if (lines.length > 4) lines.shift();
    task.output = lines.join("\n");
  };
}

export function renderProgress(
  tasks: readonly ProgressTask[],
  frame = "⠋",
  depth = 0
): string[] {
  const lines: string[] = [];
  for (const task of tasks) {
    if (!task.isEnabled()) continue;
    const failed = task.hasFailed();
    const pending = task.isPending();
    if (!pending && !failed && !task.isCompleted() && !task.isSkipped())
      continue;
    const symbol = failed
      ? "✖"
      : pending
        ? frame
        : task.isSkipped()
          ? "↓"
          : "✔";
    const indent = "  ".repeat(depth);
    lines.push(`${indent}${symbol} ${stripVTControlCharacters(task.title)}`);
    if ((pending || failed) && task.output)
      for (const line of stripVTControlCharacters(task.output)
        .split(/\r?\n/)
        .slice(-4))
        if (line.trim()) lines.push(`${indent}  │ ${line}`);
    if (pending || failed)
      lines.push(...renderProgress(task.subtasks, frame, depth + 1));
  }
  return lines;
}

/** One renderer owns the terminal; nested task lists share its bounded preview. */
export class ProgressRenderer<Ctx> {
  static nonTTY = false;
  private readonly update = createLogUpdate(process.stdout);
  private interval?: ReturnType<typeof setInterval>;
  private frame = 0;
  constructor(
    private readonly tasks: ReadonlyArray<Listr.ListrTaskObject<Ctx>>
  ) {}

  private draw(): void {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const lines = renderProgress(
      this.tasks as unknown as readonly ProgressTask[],
      frames[this.frame++ % frames.length]
    );
    const rows = lines.flatMap(line =>
      wrapAnsi(line, Math.max(10, process.stdout.columns || 80), {
        hard: true,
        trim: false,
        wordWrap: false
      }).split("\n")
    );
    this.update(
      rows.slice(-Math.max(1, (process.stdout.rows || 24) - 2)).join("\n")
    );
  }

  render(): void {
    this.draw();
    this.interval = setInterval(() => this.draw(), 100);
  }

  end(): void {
    if (this.interval) clearInterval(this.interval);
    this.draw();
    this.update.done();
  }
}
