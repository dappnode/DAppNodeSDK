import { rmSafe, mkdirSafe } from "./shellSafe";

export const testDir = "test_files";
export async function cleanTestDir(): Promise<void> {
  await rmSafe(testDir);
  await mkdirSafe(testDir);
}
