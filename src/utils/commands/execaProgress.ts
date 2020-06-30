import execa from "execa";

/**
 * Custom execa with progress logging
 */
export async function execaProgress(
  cmd: string,
  onData: (data: string) => void
) {
  const child = execa(cmd);
  if (child.stdout)
    child.stdout.on("data", chunk => {
      onData(chunk.toString().trim());
    });
  if (child.stderr)
    child.stderr.on("data", chunk => {
      onData(chunk.toString().trim());
    });

  const { stdout } = await child;
  return stdout;
}
