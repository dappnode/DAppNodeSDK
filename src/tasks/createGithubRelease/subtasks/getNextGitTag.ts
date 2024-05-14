/**
 * Returns the next git tag based on the next version defined in the context
 */
export function getNextGitTag(nextVersion?: string): string {
  if (!nextVersion) throw Error("Missing ctx.nextVersion");
  return `v${nextVersion}`;
}
