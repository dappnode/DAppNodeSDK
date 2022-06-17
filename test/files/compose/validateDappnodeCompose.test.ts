import { expect } from "chai";
import { Compose, Manifest, validateDappnodeCompose } from "../../../src/files";

describe("files / compose / validateDappnodeCompose", () => {
  const manifest: Manifest = {
    name: "prysm-prater.dnp.dappnode.eth",
    version: "1.0.0",
    upstreamVersion: "v2.1.2",
    upstreamRepo: "prysmaticlabs/prysm",
    upstreamArg: "UPSTREAM_VERSION",
    shortDescription: "Prysm prater ETH2.0 Beacon chain + validator",
    description:
      "Validate with prysm: a Go implementation of the Ethereum 2.0 Serenity protocol and open source project created by Prysmatic Labs. Beacon node which powers the beacon chain at the core of Ethereum 2.0\n\nIt includes a Grafana dashboard for the [DMS](http://my.dappnode/#/installer/dms.dnp.dappnode.eth) thanks to the amazing work of [metanull-operator](https://github.com/metanull-operator/eth2-grafana)",
    type: "service",
    architectures: ["linux/amd64"],
    chain: {
      driver: "ethereum-beacon-chain",
      serviceName: "beacon-chain",
      portNumber: 3500
    },
    mainService: "validator",
    author:
      "DAppNode Association <admin@dappnode.io> (https://github.com/dappnode)",
    contributors: [
      "dappLion <dapplion@dappnode.io> (https://github.com/dapplion)",
      "tropicar <tropicar@dappnode.io> (https://github.com/tropicar)",
      "pablo <pablo@dappnode.io> (https://github.com/pablomendezroyo)"
    ],
    license: "GPL-3.0",
    repository: {
      type: "git",
      url: "git+https://github.com/dappnode/DAppNodePackage-prysm-prater.git"
    },
    bugs: {
      url: "https://github.com/dappnode/DAppNodePackage-prysm-prater/issues"
    },
    requirements: {
      minimumDappnodeVersion: "0.2.51"
    },
    categories: ["Blockchain", "ETH2.0"],
    warnings: {
      onMajorUpdate:
        "This is a major update of Prysm Prater, it will start validating with the web3signer. There will be a migration where your keystores will be replaced to another location, pay attention to the update"
    },
    links: {
      ui:
        "http://ui.web3signer-prater.dappnode?signer_url=http://web3signer.web3signer-prater.dappnode:9000",
      homepage: "https://prysmaticlabs.com/",
      readme: "https://github.com/dappnode/DAppNodePackage-prysm-prater",
      docs: "https://docs.prylabs.network/docs/getting-started"
    },
    dependencies: {
      "goerli-geth.dnp.dappnode.eth": "latest",
      "web3signer-prater.dnp.dappnode.eth": "latest"
    }
  };

  const compose: Compose = {
    version: "3.5",
    services: {
      "beacon-chain": {
        image: "beacon-chain.prysm-prater.dnp.dappnode.eth:1.0.0",
        build: {
          context: "beacon-chain",
          args: {
            UPSTREAM_VERSION: "v2.1.2"
          }
        },
        volumes: ["beacon-chain-data:/data"],
        ports: ["13000", "12000/udp"],
        restart: "unless-stopped",
        environment: {
          HTTP_WEB3PROVIDER: "http://goerli-geth.dappnode:8545",
          CHECKPOINT_SYNC_URL: "",
          CORSDOMAIN: "http://prysm-prater.dappnode",
          WEB3_BACKUP: "",
          EXTRA_OPTS: ""
        }
      },
      validator: {
        image: "validator.prysm-prater.dnp.dappnode.eth:1.0.0",
        build: {
          context: "validator",
          dockerfile: "Dockerfile",
          args: {
            UPSTREAM_VERSION: "v2.1.2",
            BRANCH: "develop"
          }
        },
        volumes: ["validator-data:/root/"],
        restart: "unless-stopped",
        environment: {
          LOG_TYPE: "INFO",
          BEACON_RPC_PROVIDER: "beacon-chain.prysm-prater.dappnode:4000",
          BEACON_RPC_GATEWAY_PROVIDER:
            "beacon-chain.prysm-prater.dappnode:3500",
          GRAFFITI: "validating_from_DAppNode",
          EXTRA_OPTS: ""
        }
      }
    },
    volumes: {
      "beacon-chain-data": {},
      "validator-data": {}
    }
  };

  it("Should validate the compose file", () => {
    validateDappnodeCompose(compose, manifest);
  });

  it("Should throw an error due to unsafe networks", () => {
    expect(() =>
      validateDappnodeCompose(
        {
          ...compose,
          networks: {
            danger_network: {
              name: "danger_network",
              external: true
            }
          }
        },
        manifest
      )
    ).to.throw(`Error validating compose file with dappnode requirements:

The docker network danger_network is not allowed. Only docker networks dncore_network,dnpublic_network are allowed`);
  });

  it("Should throw an error due to unsafe volumes", () => {
    expect(() =>
      validateDappnodeCompose(
        {
          ...compose,
          services: {
            ...compose.services,
            validator: {
              ...compose.services.validator,
              volumes: ["/var/run/docker.sock:/var/run/docker.sock"]
            }
          }
        },
        manifest
      )
    ).to.throw(`Error validating compose file with dappnode requirements:

service validator volume /var/run/docker.sock:/var/run/docker.sock is a bind-mount, only named non-external volumes are allowed`);
  });

  it("Should throw an error due to unsafe service keys", () => {
    expect(() =>
      validateDappnodeCompose(
        {
          ...compose,
          services: {
            ...compose.services,
            validator: {
              ...compose.services.validator,
              credential_spec: "random"
            }
          }
        } as Compose,
        manifest
      )
    ).to.throw(`Error validating compose file with dappnode requirements:

service validator has key credential_spec that is not allowed. Allowed keys are: cap_add,cap_drop,command,depends_on,devices,entrypoint,environment,expose,extra_hosts,healthcheck,labels,logging,network_mode,networks,ports,privileged,restart,stop_grace_period,stop_signal,user,volumes,working_dir,security_opt,image,build,volumes,environment`);
  });

  it("Should throw an error due to unsafe compose version", () => {
    expect(() =>
      validateDappnodeCompose(
        {
          ...compose,
          version: "3.4"
        },
        manifest
      )
    ).to.throw(`Error validating compose file with dappnode requirements:

Compose version 3.4 is not supported. Minimum version is 3.5`);
  });

  it("Should throw an error due to unsafe service networks in string format", () => {
    expect(() =>
      validateDappnodeCompose(
        {
          ...compose,
          services: {
            ...compose.services,
            validator: {
              ...compose.services.validator,
              networks: ["danger_network"]
            }
          }
        },
        manifest
      )
    ).to.throw(`Error validating compose file with dappnode requirements:

service validator has a non-whitelisted docker network: danger_network. Only docker networks dncore_network,dnpublic_network are allowed`);
  });

  it("Should throw an error due to unsafe service networks in object format", () => {
    expect(() =>
      validateDappnodeCompose(
        {
          ...compose,
          services: {
            ...compose.services,
            validator: {
              ...compose.services.validator,
              networks: {
                danger_network: {
                  ipv4_address: "172.33.4.5",
                  aliases: ["dappmanager.dappnode"]
                },
                other_network: {
                  ipv4_address: "",
                  aliases: ["core.dappnode"]
                }
              }
            }
          }
        },
        manifest
      )
    ).to.throw(`Error validating compose file with dappnode requirements:

service validator has a non-whitelisted docker network: danger_network. Only docker networks dncore_network,dnpublic_network are allowed
service validator has the network danger_network with reserved docker alias. Aliases dappmanager.dappnode,wifi.dappnode,vpn.dappnode,wireguard.dappnode,ipfs.dappnode,bind.dappnode are reserved to core packages
service validator has a non-whitelisted docker network: other_network. Only docker networks dncore_network,dnpublic_network are allowed`);
  });

  it("Should throw an error due to unsafe compose version and unsafe volumes", () => {
    expect(() =>
      validateDappnodeCompose(
        {
          ...compose,
          version: "3.4",
          services: {
            ...compose.services,
            validator: {
              ...compose.services.validator,
              volumes: ["/var/run/docker.sock:/var/run/docker.sock"]
            }
          }
        },
        manifest
      )
    ).to.throw(`Error validating compose file with dappnode requirements:

Compose version 3.4 is not supported. Minimum version is 3.5
service validator volume /var/run/docker.sock:/var/run/docker.sock is a bind-mount, only named non-external volumes are allowed`);
  });
});
