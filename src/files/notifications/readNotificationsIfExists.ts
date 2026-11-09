import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { defaultDir } from "../../params.js";
import { readFile } from "../../utils/file.js";
import { NotificationsConfig, releaseFiles } from "@dappnode/types";
import { mergeReplacingArrays } from "../../utils/merge.js";
import { NotificationsPaths } from "./types.js";

/**
 * Reads one or multiple notifications YAML files and merges them. Returns null if none exist.
 * @param {NotificationsPaths[]} paths - Optional array of directory/file specs.
 * @returns {NotificationsConfig | null}
 * @throws {Error} Throws if parsing fails or non-YAML format is encountered.
 */
export function readNotificationsIfExists(
  paths?: NotificationsPaths[]
): NotificationsConfig | null {
  try {
    // Determine list of specs (default single spec if none provided)
    const specs = paths && paths.length > 0 ? paths : [{}];

    // Resolve existing file paths
    const filePaths = specs
      .map(spec => {
        try {
          return findNotificationsPath(spec);
        } catch {
          return undefined;
        }
      })
      .filter((p): p is string => typeof p === "string");

    if (filePaths.length === 0) return null;

    // Load and validate YAML-only files
    const configs = filePaths.map(fp => {
      if (!/\.(yml|yaml)$/i.test(fp))
        throw new Error("Only YAML format supported for notifications: " + fp);
      const data = readFile(fp);
      const parsed = yaml.load(data);
      if (!parsed || typeof parsed === "string")
        throw new Error(`Could not parse notifications: ${fp}`);
      return parsed as NotificationsConfig;
    });

    // Merge all configurations
    const merged = mergeReplacingArrays<Record<string, unknown>>(...configs);
    for (const key of ["endpoints", "customEndpoints"] as const) {
      const endpoints = new Map<
        string,
        NonNullable<NotificationsConfig[typeof key]>[number]
      >();
      for (const config of configs)
        for (const endpoint of config[key] || []) {
          const id = endpoint.correlationId || endpoint.name;
          endpoints.set(id, mergeReplacingArrays(endpoints.get(id), endpoint));
        }
      if (endpoints.size > 0) merged[key] = [...endpoints.values()];
    }
    return merged as NotificationsConfig;
  } catch (e) {
    throw new Error(`Error parsing notifications: ${e.message}`, { cause: e });
  }
}

// Find a notifications file, throws if not found
function findNotificationsPath(spec?: NotificationsPaths): string {
  const dirPath = spec?.dir || defaultDir;
  if (spec?.notificationsFileName) {
    return path.join(dirPath, spec.notificationsFileName);
  }
  const files: string[] = fs.readdirSync(dirPath);
  const match = files.find(f => releaseFiles.notifications.regex.test(f));
  if (!match)
    throw new Error(`No notifications file found in directory ${dirPath}`);
  return path.join(dirPath, match);
}
