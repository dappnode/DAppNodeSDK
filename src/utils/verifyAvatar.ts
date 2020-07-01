import sizeOf from "image-size";
import { CliError } from "../params";

const maxSize = 300;
const minSize = 200;

export function verifyAvatar(avatarPath: string): void {
  // image-size has conflicting types to its documentation
  // @ts-ignore
  const { width, height } = sizeOf(avatarPath);

  if (width !== height)
    throw new CliError(`Wrong avatar aspect ratio
Avatar png must be a square (1:1), but it's ${width} x ${height}`);

  if (width < minSize || width > maxSize)
    throw new CliError(`Wrong avatar aspect size
Avatar png must be a square (1:1) between ${minSize} and ${maxSize} px wide, but it's ${width} x ${height}`);
}
