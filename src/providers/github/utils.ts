const headsPrefix = "refs/heads/";
const tagsPrefix = "refs/tags/";

type Ref =
  | { type: "branch"; branch: string }
  | { type: "tag"; tag: string }
  | { type: "unknown" };

/**
 * Parses a git ref string:
 * ```
 * refs/heads/*  > { type: branch, branch: * }
 * refs/tags/*   > { type: tag, tag: * }
 * refs/remotes/ > Throws
 *
 * ```
 * @param ref "refs/heads/dapplion/feat1"
 */
export function parseRef(ref: string): Ref {
  if (ref) {
    if (ref.startsWith(headsPrefix)) {
      return {
        type: "branch",
        branch: ref.slice(headsPrefix.length)
      };
    }
    if (ref.startsWith(tagsPrefix)) {
      return {
        type: "tag",
        tag: ref.slice(tagsPrefix.length)
      };
    }
  }

  return { type: "unknown" };
}
