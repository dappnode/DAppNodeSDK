import { expect } from "chai";
import { gaTestEndToEndHandler } from "../../../src/commands/githubActions/endToEndTest/index.js";
import { Manifest } from "../../../src/types.js";
import { testDir, cleanTestDir } from "../../testUtils.js";
import path from "path";
import fs from "fs";

describe.skip("command / gaEndToEndTest", () => {
  const manifest: Manifest = {
    name: "rotki.dnp.dappnode.eth",
    version: "0.1.19",
    upstreamVersion: "v1.27.1",
    architectures: ["linux/amd64", "linux/arm64"],
    upstreamRepo: "rotki/rotki",
    upstreamArg: "UPSTREAM_VERSION",
    shortDescription:
      "Accounting and analytics tool that protects your privacy",
    description:
      "Rotki is an open source portfolio tracker, accounting and analytics tool that protects your privacy.\n\nRotki offers tracking of all your crypto assets no matter where they are. Be it on a blockchain, a DeFi protocol or on one of the supported exchanges.\n\nMore information about the source project can be found at [their official website](https://rotki.com/)",
    type: "service",
    author:
      "DAppNode Association <admin@dappnode.io> (https://github.com/dappnode)",
    contributors: [
      "pablo <pablo@dappnode.io> (https://github.com/pablomendezroyo)"
    ],
    categories: ["Blockchain"],
    repository: {
      type: "git",
      url: "git+https://github.com/dappnode/DAppNodePackage-rotki.git"
    },
    bugs: {
      url: "https://github.com/dappnode/DAppNodePackage-rotki/issues"
    },
    backup: [
      {
        name: "rotki_data",
        path: "/data"
      }
    ],
    links: {
      ui: "http://rotki.dappnode/",
      homepage: "https://rotki.com/",
      readme: "https://github.com/dappnode/DAppNodePackage-rotki"
    },
    license: "GLP-3.0",
    gettingStarted:
      "## Welcome to your Rotki App: The portfolio manager that protects your privacy\n\nNow you can:\n\n- Visit your Rotki **dashboard**: **[rotki.dappnode](http://rotki.dappnode/)**.\n- Rotki must have access to a synchronized Mainnet Ethereum node. You must have an Execution client (Besu, Erigon, Geth, or Nethermind) and Consensus client (Prysm, Teku, Lighthouse, or Nimbus) installed, and fully synced. \n- You can configure this from the [Repository Tab](http://my.dappnode/#/repository/eth) or directly from the [StakersUI](http://my.dappnode/#/stakers/)\n- You can find in the Rotki documentation the information on the different nodes you can use [Rotki](https://rotki.readthedocs.io/en/latest/usage_guide.html#rpc-nodes)\n- Explore the [Rotki documentation](https://rotki.readthedocs.io/en/latest/usage_guide.html) for more information about what can you do with Rotki.\n"
  };
  const compose = `
version: '3.5'
services:
  rotki.dnp.dappnode.eth:
    container_name: DAppNodePackage-rotki.dnp.dappnode.eth
    dns: 172.33.1.2
    environment:
      - ROTKI_ACCEPT_DOCKER_RISK=1
    image: 'rotki.dnp.dappnode.eth:0.1.19'
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: '3'
    networks:
      dncore_network:
        aliases:
          - rotki.dappnode
    restart: always
    volumes:
      - 'rotki_data:/data'
      - 'rotki_logs:/logs'
    labels:
      dappnode.dnp.dnpName: rotki.dnp.dappnode.eth
      dappnode.dnp.version: 0.1.19
      dappnode.dnp.serviceName: rotki.dnp.dappnode.eth
      dappnode.dnp.dependencies: '{}'
      dappnode.dnp.avatar: /ipfs/QmcKTqKP1FgAT6RGNFntjGaUh3iBJkEwxMifnMHCJqBPgU
      dappnode.dnp.isCore: 'false'
      dappnode.dnp.isMain: 'true'
      dappnode.dnp.default.environment: '["ROTKI_ACCEPT_DOCKER_RISK=1"]'
      dappnode.dnp.default.volumes: '["rotki_data:/data","rotki_logs:/logs"]'
volumes:
  rotki_data: {}
  rotki_logs: {}
networks:
  dncore_network:
    external: true`;

  before(() => {
    cleanTestDir();
    //  write manifest and compose files in the test directory
    fs.writeFileSync(
      path.join(testDir, "dappnode_package.json"),
      JSON.stringify(manifest, null, 2)
    );
    fs.writeFileSync(path.join(testDir, "docker-compose.yml"), compose);
  });

  it("should execute end to end tests on a real dappnode environment", async () => {
    // p
    await gaTestEndToEndHandler({
      dir: testDir,
      healthCheckUrl: "http://rotki.dappnode",
      errorLogsTimeout: 10
    });
    expect(true).to.equal(true);
  });
});
