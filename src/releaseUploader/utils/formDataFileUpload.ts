import fs from "fs";
import path from "path";
import FormData from "form-data";
import { traverseDir } from "./traverseDir";

/**
 * Prepares FormData for a HTTP POST request to upload files
 */
export function getFormDataFileUpload(dirOrFilePath: string): FormData {
  const form = new FormData();
  // Automatically detect if recursive if needed if directory
  if (fs.lstatSync(dirOrFilePath).isDirectory()) {
    const dirDir = path.parse(dirOrFilePath).dir;
    const filePaths = traverseDir(dirOrFilePath);
    for (const filePath of filePaths) {
      form.append("file", fs.createReadStream(filePath), {
        // Compute filepaths from the provided dirOrFilePath and below only
        filepath: path.relative(dirDir, filePath)
      });
    }
  } else {
    // Add single files without providing a filepath
    form.append("file", fs.createReadStream(dirOrFilePath));
  }

  return form;
}
