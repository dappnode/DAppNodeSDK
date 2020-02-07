# DAppNodeSDK

dappnodesdk is a tool to make as simple as possible the creation of new dappnode packages. It helps to initialize and publish an Aragon Package Manager Repo in the ethereum mainnet.

We have deployed a public APM (Aragon Package Manager) registry in which anyone can create their own APM repository: [public.dappnode.eth](https://etherscan.io/address/public.dappnode.eth)

## Install

```
$ npm install -g @dappnode/dappnodesdk
```

## DEMO

<p align="center"><img src="/img/demo.gif?raw=true"/></p>

## Initialization

```
$ dappnodesdk init
```

## build

Only generates the IPFS Hash to be able to install it without needing to create the APM Repo

```
$ dappnodesdk build
```

## Publish

It does the build of the image and shows the necessary transaction to be able to publish the package. The first time will create the repository but the rest will be updates of it.

**To be able to update a repository you must be the authorized dev.**

the script increases the current version of the repository based on the specified type (patch, minor, major), unless a version hasn't yet been published

for more information about versioning check [semver](https://semver.org/)

```
$ dappnodesdk publish < patch | minor | major >
```

Please take in account that the package version is not the internal version of the package you want to upload.
We use Aragon package manager, and it only lets starting with version 1 and increment one by one. Valid initial versions are `1.0.0`, `0.1.0` or `0.0.1`

## Troubleshoot

If your system does not find the binary `dappnodesdk`, please try these other methods

- Run with `npx` which may handle better global NPM packages

```
npx @dappnode/dappnodesdk <command>
```

- Prefix the binary with the location of your global NPM package installation, for example:

```
~/.npm-packages/bin/dappnodesdk <command>
```

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details
