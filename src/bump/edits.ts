import fs from "fs";
import { isDeepStrictEqual } from "util";
import yaml from "js-yaml";
import {
  Document,
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  Scalar,
  visit,
  YAMLMap,
  YAMLSeq
} from "yaml";
import { BumpCompose } from "./discovery.js";

/** A value to set at a path of a parsed manifest or compose file. */
export interface ValueChange {
  path: (string | number)[];
  value: string;
}

/** A file to write, with the content it was planned from. */
export interface PlannedFile {
  path: string;
  before: string;
  after: string;
}

/** Replaces the text between `start` and `end` with `value`. */
interface TextEdit {
  start: number;
  end: number;
  value: string;
}

interface ComposeEdits {
  edits: TextEdit[];
  changes: ValueChange[];
  foundArgs: Set<string>;
}

/**
 * Sets values in manifest JSON, keeping its formatting and key order.
 */
export function editManifest(text: string, changes: ValueChange[]): string {
  // Only JSON manifests are edited
  JSON.parse(text);

  const doc = parseEditableDocument(text);
  const edits: TextEdit[] = [];
  for (const change of changes) {
    const node = doc.getIn(change.path, true);
    const edit = getScalarEdit(text, node, change.value, true);
    if (edit) edits.push(edit);
  }

  const edited = applyTextEdits(text, edits);
  validateEdits(text, edited, changes, true);
  return edited;
}

/**
 * Sets compose build args, keeping comments, quotes and formatting. `updates`
 * maps arg names to their new value; at least one service must declare each.
 */
export function editCompose(
  text: string,
  updates: Map<string, string>
): string {
  const doc = parseEditableDocument(text);
  const compose = yaml.load(text) as BumpCompose;
  const result: ComposeEdits = { edits: [], changes: [], foundArgs: new Set() };

  for (const service of Object.keys(compose.services || {})) {
    const argsPath = ["services", service, "build", "args"];
    const args = doc.getIn(argsPath, true);
    if (isMap(args)) editMappingArgs(text, args, argsPath, updates, result);
    else if (isSeq(args)) editListArgs(text, args, argsPath, updates, result);
  }

  for (const arg of updates.keys()) {
    if (!result.foundArgs.has(arg))
      throw Error(`Required Compose build argument '${arg}' is absent`);
  }

  const edited = applyTextEdits(text, result.edits);
  validateEdits(text, edited, result.changes);
  return edited;
}

/**
 * Parses both texts and checks that the edited one differs from the original
 * only by `changes`, so an edit can never change any other value.
 */
export function validateEdits(
  before: string,
  after: string,
  changes: ValueChange[],
  json = false
): void {
  const parse = (text: string): unknown =>
    json ? JSON.parse(text) : yaml.load(text);

  const expected = parse(before);
  for (const change of changes) setValueAtPath(expected, change);

  if (!isDeepStrictEqual(expected, parse(after)))
    throw Error(
      "Edit changed values outside the intended upstream/package updates"
    );
}

/**
 * Writes the planned files, after checking that none changed since planning.
 */
export function writePlan(plan: PlannedFile[]): void {
  for (const file of plan) {
    if (fs.readFileSync(file.path, "utf8") !== file.before)
      throw Error(`File changed during bump planning: ${file.path}`);
  }

  for (const file of plan) {
    if (file.after !== file.before) fs.writeFileSync(file.path, file.after);
  }
}

/**
 * Parses YAML or JSON, keeping node positions. Aliases and merge keys are
 * rejected, since editing one node could then change several values.
 */
function parseEditableDocument(text: string): Document.Parsed {
  const doc = parseDocument(text, { uniqueKeys: true });
  if (doc.errors.length > 0)
    throw Error(
      `Invalid document: ${doc.errors.map(error => error.message).join("; ")}`
    );

  visit(doc, {
    Node(key, node) {
      if (isAlias(node))
        throw Error("Aliases are ambiguous for upstream edits");
      if (key === "key" && isScalar(node) && node.value === "<<")
        throw Error("YAML merges are ambiguous for upstream edits");
    }
  });

  return doc;
}

function editMappingArgs(
  text: string,
  args: YAMLMap,
  argsPath: string[],
  updates: Map<string, string>,
  result: ComposeEdits
): void {
  for (const [arg, value] of updates) {
    if (!args.has(arg)) continue;
    result.foundArgs.add(arg);

    const edit = getScalarEdit(text, args.get(arg, true), value);
    if (edit) {
      result.edits.push(edit);
      result.changes.push({ path: [...argsPath, arg], value });
    }
  }
}

function editListArgs(
  text: string,
  args: YAMLSeq,
  argsPath: string[],
  updates: Map<string, string>,
  result: ComposeEdits
): void {
  args.items.forEach((node, index) => {
    if (!isScalar(node) || typeof node.value !== "string")
      throw Error("List build args must be strings");

    const separator = node.value.indexOf("=");
    const arg = (
      separator < 0 ? node.value : node.value.slice(0, separator)
    ).trim();
    const value = updates.get(arg);
    if (value === undefined) return;
    result.foundArgs.add(arg);

    const entry = `${arg}=${value}`;
    const edit = getScalarEdit(text, node, entry);
    if (edit) {
      result.edits.push(edit);
      result.changes.push({ path: [...argsPath, index], value: entry });
    }
  });
}

/**
 * Returns the edit that sets a scalar node to `value` in its current quote
 * style, or null when it already has that value.
 */
function getScalarEdit(
  text: string,
  node: unknown,
  value: string,
  json = false
): TextEdit | null {
  if (!isScalar(node) || !node.range)
    throw Error("Expected a scalar at the edit location");
  if (node.value === value) return null;

  const [start, end] = node.range;
  if (!text.slice(start, end)) throw Error("Empty scalar edit location");

  return { start, end, value: formatScalar(node, value, json) };
}

function formatScalar(node: Scalar, value: string, json: boolean): string {
  if (json || node.type === Scalar.QUOTE_DOUBLE) return JSON.stringify(value);
  if (node.type === Scalar.QUOTE_SINGLE)
    return `'${value.replace(/'/g, "''")}'`;
  if (node.type === Scalar.PLAIN) {
    // Quote values that YAML would not read back as the same string, e.g. 1.10
    return yaml.load(value) === value ? value : JSON.stringify(value);
  }
  throw Error("Block scalars cannot be safely edited as upstream pins");
}

/**
 * Applies the edits from the end of the text backwards, so that the offsets of
 * the remaining edits stay valid.
 */
function applyTextEdits(text: string, edits: TextEdit[]): string {
  const sortedEdits = [...edits].sort((a, b) => b.start - a.start);

  let edited = text;
  let previousStart = text.length;
  for (const edit of sortedEdits) {
    if (edit.end > previousStart) throw Error("Overlapping upstream edits");
    edited = edited.slice(0, edit.start) + edit.value + edited.slice(edit.end);
    previousStart = edit.start;
  }

  return edited;
}

function setValueAtPath(root: unknown, { path, value }: ValueChange): void {
  let parent = root;
  for (const key of path.slice(0, -1)) {
    if (!hasKey(parent, key)) throw Error("Missing edit path");
    parent = parent[key];
  }

  const key = path[path.length - 1];
  if (!hasKey(parent, key)) throw Error("Missing edit value");
  parent[key] = value;
}

function hasKey(
  value: unknown,
  key: string | number
): value is Record<string | number, unknown> {
  return typeof value === "object" && value !== null && key in value;
}
