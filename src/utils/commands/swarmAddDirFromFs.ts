import { Swarm } from "../Swarm";
import { getDirSize } from "../getDirSize";

export async function swarmAddDirFromFs(
  dirPath: string,
  swarmProvider: string,
  onProgress?: (percent: number) => void
) {
  const swarm = new Swarm(swarmProvider);

  const totalSize = getDirSize(dirPath);
  const rootHash = await swarm.addDirFromFs(dirPath, prog => {
    if (onProgress) onProgress(prog / totalSize);
  });
  return `/bzz/${rootHash}`;
}
