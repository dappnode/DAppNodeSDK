import { createLogUpdate } from "log-update";
import wrapAnsi from "wrap-ansi";
import chalk from "chalk";
import { stripVTControlCharacters } from "util";
import type Listr from "listr";

const previewLines = 4;

export interface ProgressTask {
  title: string;
  output?: string;
  state?: string;
  subtasks: readonly ProgressTask[];
  isEnabled(): boolean;
  isPending(): boolean;
  isCompleted(): boolean;
  isSkipped(): boolean;
  hasFailed(): boolean;
}

interface ListrEvent {
  type: string;
  data?: string;
}

interface ObservableTask extends ProgressTask {
  subtasks: readonly ObservableTask[];
  subscribe(next: (event: ListrEvent) => void, error?: () => void): unknown;
}

/**
 * Report each complete log line once as the task output.
 * Verbose renderers log every line exactly once; the terminal renderer keeps its own short history.
 */
export function taskLog(task: { output?: string }): (line: string) => void {
  return line => {
    task.output = stripVTControlCharacters(line);
  };
}

/** Whether a renderer has streamed task output to the console, so a failed command's log was already shown. */
let outputStreamed = false;
export function wasTaskOutputStreamed(): boolean {
  return outputStreamed;
}

/**
 * Renders the task tree. A pending task shows its last few output lines.
 * A failed task shows only its title, because listr sets the failed task's output to the error message
 * and the CLI reports that error once, after rendering ends.
 */
export function renderProgress(
  tasks: readonly ProgressTask[],
  frame = "⠋",
  depth = 0,
  history?: WeakMap<object, string[]>
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
    if (pending) {
      const recent = history
        ? history.get(task) || []
        : stripVTControlCharacters(task.output || "").split(/\r?\n/);
      for (const line of recent.slice(-previewLines))
        if (line.trim()) lines.push(`${indent}  │ ${line}`);
    }
    if (pending || failed)
      lines.push(...renderProgress(task.subtasks, frame, depth + 1, history));
  }
  return lines;
}

/** Calls `onEvent` for every event of every task, including subtasks created later. */
function watchTasks(
  tasks: readonly ObservableTask[],
  onEvent: (task: ObservableTask, event: ListrEvent) => void
): void {
  for (const task of tasks)
    task.subscribe(
      event => {
        if (event.type === "SUBTASKS") watchTasks(task.subtasks, onEvent);
        else onEvent(task, event);
      },
      // Errors are reported once by the CLI, not by the renderer.
      () => {}
    );
}

/** One renderer owns the terminal; nested task lists share its bounded preview. */
export class ProgressRenderer<Ctx> {
  static nonTTY = false;
  private readonly update = createLogUpdate(process.stdout);
  private readonly history = new WeakMap<object, string[]>();
  private interval?: ReturnType<typeof setInterval>;
  private frame = 0;
  constructor(
    private readonly tasks: ReadonlyArray<Listr.ListrTaskObject<Ctx>>
  ) {}

  private draw(): void {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const lines = renderProgress(
      this.tasks as unknown as readonly ProgressTask[],
      frames[this.frame++ % frames.length],
      0,
      this.history
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
    watchTasks(
      this.tasks as unknown as readonly ObservableTask[],
      (task, event) => {
        if (event.type !== "DATA" || task.hasFailed() || !event.data) return;
        const lines = this.history.get(task) || [];
        lines.push(...stripVTControlCharacters(event.data).split(/\r?\n/));
        this.history.set(task, lines.slice(-previewLines));
      }
    );
    this.draw();
    this.interval = setInterval(() => this.draw(), 100);
  }

  end(): void {
    if (this.interval) clearInterval(this.interval);
    this.draw();
    this.update.done();
  }
}

/** Line-by-line log for CI and --verbose: every output line once, without repeating the error. */
export class VerboseRenderer<Ctx> {
  static nonTTY = true;
  constructor(
    private readonly tasks: ReadonlyArray<Listr.ListrTaskObject<Ctx>>
  ) {}

  private log(message: string): void {
    const time = new Date().toTimeString().slice(0, 8);
    console.log(`${chalk.dim(`[${time}]`)} ${message}`);
  }

  render(): void {
    outputStreamed = true;
    watchTasks(
      this.tasks as unknown as readonly ObservableTask[],
      (task, event) => {
        if (event.type === "STATE") {
          this.log(
            `${task.title} [${task.isPending() ? "started" : task.state}]`
          );
          if (task.isSkipped() && task.output) this.log(`→ ${task.output}`);
        } else if (event.type === "DATA") {
          // On failure listr sets the output to the error message; the CLI prints it once.
          if (!task.hasFailed() && event.data) this.log(`→ ${event.data}`);
        } else if (event.type === "TITLE") {
          this.log(`${task.title} [title changed]`);
        }
      }
    );
  }

  end(): void {}
}

export function getRendererOptions({
  verbose,
  silent
}: {
  verbose?: boolean;
  silent?: boolean;
}): {
  renderer: "silent" | typeof ProgressRenderer | typeof VerboseRenderer;
  nonTTYRenderer: "silent" | typeof VerboseRenderer;
} {
  if (silent && !verbose)
    return { renderer: "silent", nonTTYRenderer: "silent" };
  return {
    renderer: verbose ? VerboseRenderer : ProgressRenderer,
    nonTTYRenderer: VerboseRenderer
  };
}
