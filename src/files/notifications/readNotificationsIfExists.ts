import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { defaultDir } from "../../params.js";
import { readFile } from "../../utils/file.js";
import { NotificationsConfig, releaseFiles} from "@dappnode/types";

export function readNotificationsIfExists(dir?: string): NotificationsConfig | null {
  const dirPath = dir || defaultDir;
  const notificationsFileName = fs
    .readdirSync(dirPath)
    .find(file => releaseFiles.notifications.regex.test(file));

  if (!notificationsFileName) return null;
  const data = readFile(path.join(dirPath, notificationsFileName));

  // Parse notifications in try catch block to show a comprehensive error message
  try {
    return yaml.load(data);
  } catch (e) {
    throw Error(`Error parsing notifications: ${e.message}`);
  }
}
