import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import yaml from "js-yaml";
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  Scalar,
  visit
} from "yaml";
import { BumpCompose } from "./discovery.js";

export interface ValueChange {
  path: (string | number)[];
  value: string;
}
interface TextEdit {
  start: number;
  end: number;
  value: string;
}

function document(text: string) {
  const doc = parseDocument(text, { uniqueKeys: true });
  if (doc.errors.length)
    throw Error(
      `Invalid document: ${doc.errors.map(error => error.message).join("; ")}`
    );
  visit(doc, {
    Node(key, node) {
      if (isAlias(node))
        throw Error("Aliases are ambiguous for upstream edits");
      if (isScalar(node) && node.value === "<<" && key === "key")
        throw Error("YAML merges are ambiguous for upstream edits");
    }
  });
  return doc;
}

function scalarEdit(
  text: string,
  node: unknown,
  value: string,
  json = false
): TextEdit | null {
  if (!isScalar(node) || !node.range)
    throw Error("Expected a scalar at the edit location");
  if (node.value === value) return null;
  let replacement: string;
  if (json || node.type === Scalar.QUOTE_DOUBLE)
    replacement = JSON.stringify(value);
  else if (node.type === Scalar.QUOTE_SINGLE)
    replacement = `'${value.replace(/'/g, "''")}'`;
  else if (node.type === Scalar.PLAIN && yaml.load(value) === value)
    replacement = value;
  else if (node.type === Scalar.PLAIN) replacement = JSON.stringify(value);
  else throw Error("Block scalars cannot be safely edited as upstream pins");
  const [start, end] = node.range;
  if (!text.slice(start, end)) throw Error("Empty scalar edit location");
  return { start, end, value: replacement };
}

function replace(text: string, edits: (TextEdit | null)[]): string {
  let previous = text.length;
  for (const edit of edits
    .filter((edit): edit is TextEdit => edit !== null)
    .sort((a, b) => b.start - a.start)) {
    if (edit.end > previous) throw Error("Overlapping upstream edits");
    text = text.slice(0, edit.start) + edit.value + text.slice(edit.end);
    previous = edit.start;
  }
  return text;
}

/** Reparse independently, allowing only the explicitly requested semantic changes. */
export function validateEdits(
  before: string,
  after: string,
  changes: ValueChange[],
  json = false
): void {
  const parse = (text: string): unknown =>
    json ? JSON.parse(text) : yaml.load(text);
  const expected = parse(before);
  for (const change of changes) {
    let parent = expected as Record<string | number, unknown>;
    for (const key of change.path.slice(0, -1)) {
      if (!parent || typeof parent !== "object" || !(key in parent))
        throw Error("Missing edit path");
      parent = parent[key] as Record<string | number, unknown>;
    }
    const key = change.path[change.path.length - 1];
    if (!parent || typeof parent !== "object" || !(key in parent))
      throw Error("Missing edit value");
    parent[key] = change.value;
  }
  if (!isDeepStrictEqual(expected, parse(after)))
    throw Error(
      "Edit changed values outside the intended upstream/package updates"
    );
}

export function editManifest(text: string, changes: ValueChange[]): string {
  JSON.parse(text);
  const doc = document(text);
  const result = replace(
    text,
    changes.map(change =>
      scalarEdit(text, doc.getIn(change.path, true), change.value, true)
    )
  );
  validateEdits(text, result, changes, true);
  return result;
}

export function editCompose(
  text: string,
  updates: Map<string, string>
): string {
  const doc = document(text);
  const compose = yaml.load(text) as BumpCompose;
  const edits: (TextEdit | null)[] = [];
  const changes: ValueChange[] = [];
  const found = new Set<string>();
  for (const service of Object.keys(compose.services || {})) {
    const base = ["services", service, "build", "args"];
    const args = doc.getIn(base, true);
    if (isMap(args)) {
      for (const [arg, value] of updates) {
        if (!args.has(arg)) continue;
        found.add(arg);
        const node = args.get(arg, true);
        edits.push(scalarEdit(text, node, value));
        if (!isScalar(node) || node.value !== value)
          changes.push({ path: [...base, arg], value });
      }
    } else if (isSeq(args)) {
      args.items.forEach((node, index) => {
        if (!isScalar(node) || typeof node.value !== "string")
          throw Error("List build args must be strings");
        const split = node.value.indexOf("=");
        const arg = (
          split < 0 ? node.value : node.value.slice(0, split)
        ).trim();
        const value = updates.get(arg);
        if (value === undefined) return;
        found.add(arg);
        const replacement = `${arg}=${value}`;
        edits.push(scalarEdit(text, node, replacement));
        if (node.value !== replacement)
          changes.push({ path: [...base, index], value: replacement });
      });
    }
  }
  for (const arg of updates.keys())
    if (!found.has(arg))
      throw Error(`Required Compose build argument '${arg}' is absent`);
  const result = replace(text, edits);
  validateEdits(text, result, changes);
  return result;
}

export interface PlannedFile {
  path: string;
  before: string;
  after: string;
}

export function writePlan(plan: PlannedFile[]): void {
  for (const file of plan)
    if (fs.readFileSync(file.path, "utf8") !== file.before)
      throw Error(`File changed during bump planning: ${file.path}`);
  for (const file of plan)
    if (file.before !== file.after) fs.writeFileSync(file.path, file.after);
}
