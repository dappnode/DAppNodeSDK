// @ts-ignore // No type definitions for "is-ipfs"
import * as isIPFS from "is-ipfs";

function isMultihash(hash: string) {
  return isIPFS.cid(hash);
}

export function parseIpfsPath(hash: string): string {
  if (hash.includes("ipfs/")) {
    hash = hash.split("ipfs/")[1];
  }
  return hash;
}

/**
 * Checks if the given string is a valid IPFS CID or path
 *
 * isIPFS.cid('QmYjtig7VJQ6XsnUjqqJvj7QaMcCAwtrgNdahSiFofrE7o') // true (CIDv0)
 * isIPFS.cid('zdj7WWeQ43G6JJvLWQWZpyHuAMq6uYWRjkBXFad11vE2LHhQ7') // true (CIDv1)
 * isIPFS.cid('noop') // false
 *
 * @param hash
 */
export function isIpfsHash(hash: string): boolean {
  if (!hash || typeof hash !== "string") return false;
  // Correct hash prefix
  hash = parseIpfsPath(hash);
  hash.replace("/", "");
  // Make sure hash if valid
  return isMultihash(hash);
}

