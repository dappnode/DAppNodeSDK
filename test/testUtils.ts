import { rmSafe, mkdirSafe } from "./shellSafe";

export const testDir = "test_files";
export async function cleanTestDir(): Promise<void> {
  rmSafe(testDir);
  await mkdirSafe(testDir);
}
