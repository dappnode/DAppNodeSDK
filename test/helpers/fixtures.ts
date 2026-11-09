import fs from "fs";
import os from "os";
import path from "path";

export function temporaryDirectory(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sdk-quality-"));
}

export function executable(dir: string, name: string, script: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), `#!${process.execPath}\n${script}\n`, {
    mode: 0o755
  });
}

export function useExecutables(dir: string): () => void {
  const original = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${original || ""}`;
  return () => {
    process.env.PATH = original;
  };
}
