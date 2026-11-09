import { imageSize } from "image-size";
import fs from "fs";
import { CliError } from "../params.js";

const maxSize = 300;
const minSize = 200;

export function verifyAvatar(avatarPath: string): void {
  const { width, height } = imageSize(fs.readFileSync(avatarPath));

  if (width !== height)
    throw new CliError(`Wrong avatar aspect ratio
Avatar png must be a square (1:1), but it's ${width} x ${height}`);

  if (width < minSize || width > maxSize)
    throw new CliError(`Wrong avatar aspect size
Avatar png must be a square (1:1) between ${minSize} and ${maxSize} px wide, but it's ${width} x ${height}`);
}
