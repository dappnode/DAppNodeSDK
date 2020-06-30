import fs from "fs";
import path from "path";

interface FileParams {
  required: boolean;
  regex: RegExp;
  defaultName: string;
  id: string;
}

export function getAssetPath(
  { required, regex, defaultName, id }: FileParams,
  dir: string
): string | undefined {
  const files = fs.readdirSync(dir);
  const matchingFiles = files.filter(file => regex.test(file));

  if (matchingFiles.length === 0)
    if (required)
      throw Error(`No ${id} found in ${dir}.
${id} naming must match ${regex.toString()}.
Please rename it to ${defaultName}
`);
  if (matchingFiles.length === 1) return path.join(dir, matchingFiles[0]);
  else
    throw Error(`More than one ${id} found in ${dir}.
Only one file can match ${regex.toString()}
Please rename it to ${defaultName}      
`);
}

/**
 * Get asset path but always return a string
 * Necessary for the Typescript compiler
 * @param fileParams
 * @param dir
 */
export function getAssetPathRequired(
  fileParams: FileParams,
  dir: string
): string {
  const assetPath = getAssetPath(fileParams, dir);
  if (!assetPath) throw Error(`No ${fileParams.id} found in ${dir}`);
  return assetPath;
}
