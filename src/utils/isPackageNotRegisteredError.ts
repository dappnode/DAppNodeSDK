/**
 * True when an APM lookup failed because the package has no repository on the
 * registry yet, rather than because something actually went wrong.
 *
 * This is the normal state when publishing a package for the first time, and
 * callers use it to fall back to the version declared in the manifest.
 *
 * The condition has to be recognised from the error message because it surfaces
 * differently depending on the ethers version resolving the ENS name:
 *
 * - `NOREPO` is raised by @dappnode/toolkit when the name resolves but carries
 *   no repository.
 * - `Could not resolve name` is what ethers v6 reported for an unresolvable
 *   name in earlier releases.
 * - `ResolverNotFound` is the ENS custom error current ethers decodes and
 *   raises instead. Without it, a first publish fails with
 *   `execution reverted: ResolverNotFound(bytes)`.
 *
 * Errors that merely reverted for some other reason are deliberately not
 * matched, so a genuine registry failure is never mistaken for an unpublished
 * package.
 */
export function isPackageNotRegisteredError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return (
    message.includes("NOREPO") ||
    message.includes("Could not resolve name") ||
    message.includes("ResolverNotFound")
  );
}
