export const bumpDeprecation =
  "dappnodesdk github-action bump-upstream is deprecated and will be removed in a future release. DAppNode org packages: call the reusable workflow dappnode/workflows/.github/workflows/bump-upstream.yml@master. Other packages: use the dappnode/workflows/actions/bump-upstream@master action, which edits the files, followed by your own PR step.";

export function printBumpDeprecation(
  log: (message: string) => void = console.log
): void {
  log(bumpDeprecation);
  log(
    `::warning title=dappnodesdk bump-upstream is deprecated::${bumpDeprecation}`
  );
}
