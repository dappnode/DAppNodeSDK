# DAppNodeSDK

The DappnodeSDK `dappnodesdk` is a tool that makes creating and publishing new Dappnode packages as simple as possible. It helps to initialize, build, test, and publish the new package/repo to an APM tracked on the Ethereum Mainnet.

We have deployed a public APM (Aragon Package Manager) registry in which anyone can create their own APM repository: [public.dappnode.eth](https://etherscan.io/address/public.dappnode.eth)

## Install

```
$ npm install -g @dappnode/dappnodesdk
```

## DEMO

<p align="center"><img src="/img/demo.gif?raw=true"/></p>

## Initialization

This command runs you through a setup wizard to begin creating the basic files for a new Dappnode Package Repo.

```
$ dappnodesdk init
```

## Build

Only generates the IPFS Hash to be able to install it without needing to create the APM Repo

```
$ dappnodesdk build
```

## Publish

It does the build of the image and shows the necessary transaction to be able to publish the package. The first time will create the repository but the rest will be updates of it.

**To be able to update a repository you must be the authorized dev.**

The script increases the current version of the repository based on the specified type (patch, minor, major), unless a version hasn't yet been published

For more information about versioning check [semver](https://semver.org/)

```
$ dappnodesdk publish < patch | minor | major >
```

Please take in account that the _package version_ is not the _internal version_ of the package you want to upload.
We use Aragon package manager, and it only allows starting with version 1 and incrementing it one by one. Valid initial versions are `1.0.0`, `0.1.0` or `0.0.1`.

## Troubleshooting

If your system does not find the binary `dappnodesdk` when running the command, please try the following alternative methods

- Run with `npx` which may handle better global NPM packages

```
npx @dappnode/dappnodesdk <command>
```

- Prefix the binary with the location of your global NPM package installation, for example:

```
~/.npm-packages/bin/dappnodesdk <command>
```

## Github Actions

### `bump-upstream` action

This Github Action automatically creates pull requests bumping the version to the latest released upstream version on DAppNode Packages. It then tests building the new bumped upstream version and automatically posts an IPFS hash if the build was successful so that the new version can be tested further with other Github Actions and by human testers.

_Note: This action also requires a Pinata account with an API Access Token and a Github Personal Access Token stored in the repo's, individual's, or organization's secrets in order to work properly._

#### Sample Usage

`.github/workflows/auto_check.yml`

```yaml
name: Bump upstream version

on:
  schedule:
    - cron: "00 */4 * * *"
  push:
    branches:
      - "master"

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npx @dappnode/dappnodesdk github-action bump-upstream
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PINATA_API_KEY: ${{ secrets.PINATA_API_KEY }}
          PINATA_SECRET_API_KEY: ${{ secrets.PINATA_SECRET_API_KEY }}
```

You must specify in the package manifest what upstream Github repo the package is tracking. Also indicate what build variable in the docker-compose file should be updated.

`dappnode_package.json`

```json
{
  "name": "prysm.dnp.dappnode.eth",
  "upstreamVersion": "v1.0.0",
  "upstreamRepo": "prysmaticlabs/prysm",
  "upstreamArg": "UPSTREAM_VERSION"
}
```

`docker-compose.yml`

```yaml
version: "3.4"
services:
  beacon-chain:
    build:
      args:
        UPSTREAM_VERSION: v1.0.0
```

## Internal dependencies

The dappnode SDK ueses the following internal dependencies to avoid code duplication across the `dappnodeSDK`, `DNP_DAPPMANAGER` and `sdk-publish` modules:

- `@dappnode/types`
- `@dappnode/toolkit`
- `@dappnode/schemas`

In order to have a better developing experience these modules lives inside the DNP_DAPPMANAGER repository

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details
