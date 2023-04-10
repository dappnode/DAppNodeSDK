import { expect } from "chai";
import { Manifest } from "../../src/files/index.js";
import {
  validateComposeSchema,
  validateManifestSchema,
  validateSetupWizardSchema
} from "../../src/schemaValidation/index.js";
import fs from "fs";
import path from "path";
import { cleanTestDir, testDir } from "../testUtils.js";

describe("schemaValidation", () => {
  describe("manifest", () => {
    it("validateManifest globalEnvs as array of objects", () => {
      const manifest: Manifest = {
        name: "",
        version: "1.0.0",
        description: "",
        type: "dncore",
        license: "1",
        globalEnvs: [
          {
            services: ["web3signer", "ui"],
            envs: ["_DAPPNODE_GLOBAL_INTERNAL_IP", "_DAPPNODE_GLOBAL_PUBLIC_IP"]
          },
          {
            services: ["db"],
            envs: ["_DAPPNODE_GLOBAL_PUBKEY"]
          }
        ],
        chain: {
          driver: "ethereum"
        }
      };

      expect(() => validateManifestSchema(manifest)).to.not.throw();
    });

    it("validateManifest chainDriver as string", () => {
      const manifest: Manifest = {
        name: "",
        version: "1.0.0",
        description: "",
        type: "dncore",
        license: "1",
        chain: {
          driver: "ethereum"
        }
      };

      expect(() => validateManifestSchema(manifest)).to.not.throw();
    });

    it("validateManifest chainDriver as object", () => {
      const manifest: Manifest = {
        name: "",
        version: "1.0.0",
        description: "",
        type: "dncore",
        license: "1",
        chain: "ethereum"
      };

      expect(() => validateManifestSchema(manifest)).to.not.throw();
    });

    it("throw error validating with wrong chain", () => {
      // Override chain property with invalid valid to test schema
      const manifest: Omit<Manifest, "chain"> & { chain: string } = {
        name: "",
        version: "1.0.0",
        description: "",
        type: "dncore",
        license: "1",
        chain: "notAllowed"
      };

      expect(() => validateManifestSchema(manifest as Manifest)).to.throw();
    });
  });

  describe("compose", () => {
    it("should validate a valid compose", async () => {
      const validCompose = `version: "3.4"
services:
  beacon-chain:
    image: "beacon-chain.prysm-prater.dnp.dappnode.eth:1.0.0"
    volumes:
      - "beacon-chain-data:/data"
    ports:
      - "13000"
      - 12000/udp
    restart: unless-stopped
    environment:
      HTTP_WEB3PROVIDER: "http://goerli-geth.dappnode:8545"
      CHECKPOINT_SYNC_URL: ""
      CORSDOMAIN: "http://prysm-prater.dappnode"
      WEB3_BACKUP: ""
      EXTRA_OPTS: ""
  validator:
    image: "validator.prysm-prater.dnp.dappnode.eth:1.0.0"
    volumes:
      - "validator-data:/root/"
    restart: unless-stopped
    environment:
      LOG_TYPE: INFO
      BEACON_RPC_PROVIDER: "beacon-chain.prysm-prater.dappnode:4000"
      BEACON_RPC_GATEWAY_PROVIDER: "beacon-chain.prysm-prater.dappnode:3500"
      GRAFFITI: validating_from_DAppNode
      EXTRA_OPTS: ""
      FEE_RECIPIENT_ADDRESS: ""
volumes:
  beacon-chain-data: {}
  validator-data: {}`;
      const validComposePath = path.join(testDir, "valid-docker-compose.yml");
      fs.writeFileSync(validComposePath, validCompose);
      expect(
        async () => await validateComposeSchema(validComposePath)
      ).to.not.throw();
    });

    it("should throw error with an invalid compose", async () => {
      const invalidCompose = `version: "3.5"
services:
  ui:
    image: "ui.web3signer-gnosis.dnp.dappnode.eth:0.1.0"
    build:
      context: ui
    restart: unless-stopped
  web3signer:
    image: "web3signer.web3signer-gnosis.dnp.dappnode.eth:0.1.0"
    depends_on:
      - postgres
    security_opt:
      - "seccomp:unconfined"
    environment:
      ETH2_CLIENT: ""
      LOG_TYPE: INFO
      EXTRA_OPTS: ""
    volumes:
      - "web3signer_data:/opt/web3signer"
    restart: unless-stopped
  postgres:
    notAllowed: wrong
    image: "postgres.web3signer-gnosis.dnp.dappnode.eth:0.1.0"
    healthcheck:
      test: pg_isready -U postgres
      interval: 5s
      timeout: 5s
      retries: 5
    build:
      context: postgres
      dockerfile: Dockerfile
      args:
        UPSTREAM_VERSION: 22.6.0
    user: postgres
    volumes:
      - "postgres_data:/var/lib/postgresql/data"
      - "postgres_migrations:/docker-entrypoint-initdb.d"
    restart: unless-stopped
volumes:
  web3signer_data: {}
  postgres_data: {}
  postgres_migrations: {}`;
      const invalidComposePath = path.join(
        testDir,
        "invalid-docker-compose.yml"
      );
      fs.writeFileSync(invalidComposePath, invalidCompose);

      const error = await validateComposeSchema(invalidComposePath).catch(
        e => e
      );
      const expectedErrorMessage = `Invalid compose:
The Compose file './test_files/invalid-docker-compose.yml' is invalid because:
Unsupported config option for services.postgres: 'notAllowed'`;
      expect(error.message).to.include(expectedErrorMessage);
    });

    after(() => {
      cleanTestDir();
    });
  });

  describe("setupWizard", () => {
    const setupWizardPath = path.join(testDir, "setup-wizard.yml");

    beforeEach(() => {
      cleanTestDir();
    });
    it("should validate a valid setupWizard", () => {
      const validSetupWizardString = `
version: "2"
fields:
  - id: GRAFFITI
    target:
      type: environment
      name: GRAFFITI
      service: validator
    title: Graffiti
    maxLength: 32
    description: >-
      Add a string to your proposed blocks, which will be seen on the block explorer
  - id: HTTP_WEB3PROVIDER
    target:
      type: environment
      name: HTTP_WEB3PROVIDER
      service: [validator, beacon-chain]
    title: Eth1.x node URL
    description: >-
      URL to the Eth1.x node need for the Beacon chain.
  - id: web3Backup
    target:
      type: environment
      name: WEB3_BACKUP
      service: beacon-chain
    title: Add a backup web3 provider
    description: >-
      It's a good idea to add a backup web3 provider in case your main one goes down. For example, if your primary EL client is a local Geth, but you want to use Infura as a backup.
      Get your web3 backup from [infura](https://infura.io/) (i.e https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@eth2-beacon-prater.infura.io)
    required: false
  - id: checkpointSyncUrl
    target:
      type: environment
      name: CHECKPOINT_SYNC_URL
      service: beacon-chain
    title: Checkpoint for fast sync
    description: >-
      To get Prysm up and running in only a few minutes, you can start Prysm from a recent finalized checkpoint state rather than syncing from genesis. This is substantially **faster** and consumes **less resources** than syncing from genesis, while still providing all the same features. Be sure you are using a trusted node for the fast sync. Check [Prysm docs](https://docs.prylabs.network/docs/prysm-usage/parameters/)
      Get your checkpoint sync from [infura](https://infura.io/) (i.e https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@eth2-beacon-prater.infura.io)
    required: false`;

      fs.writeFileSync(setupWizardPath, validSetupWizardString);

      expect(() => validateSetupWizardSchema(testDir)).to.not.throw();
    });

    it("should throw error with an invalid setupWizard", () => {
      const invalidSetupWizardString = `
version: "2"
fields:
  - id: GRAFFITI
    target:
      type: environment
      name: GRAFFITI
      service: validator
    title: Graffiti
    maxLength: 32
    description: >-
      Add a string to your proposed blocks, which will be seen on the block explorer
  - id: HTTP_WEB3PROVIDER
    target:
      type: environment
      name: HTTP_WEB3PROVIDER
      service: beacon-chain
    title: Eth1.x node URL
    description: >-
      URL to the Eth1.x node need for the Beacon chain.
  - id: web3Backup
    target:
      type: environment
      name: WEB3_BACKUP
      service: beacon-chain
    title: Add a backup web3 provider
    description: >-
      It's a good idea to add a backup web3 provider in case your main one goes down. For example, if your primary EL client is a local Geth, but you want to use Infura as a backup.
      Get your web3 backup from [infura](https://infura.io/) (i.e https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@eth2-beacon-prater.infura.io)
    required: false
  - id: checkpointSyncUrl
    target:
      type: environment
      name: CHECKPOINT_SYNC_URL
      service: beacon-chain
    title: Checkpoint for fast sync
    description: >-
      To get Prysm up and running in only a few minutes, you can start Prysm from a recent finalized checkpoint state rather than syncing from genesis. This is substantially **faster** and consumes **less resources** than syncing from genesis, while still providing all the same features. Be sure you are using a trusted node for the fast sync. Check [Prysm docs](https://docs.prylabs.network/docs/prysm-usage/parameters/)
      Get your checkpoint sync from [infura](https://infura.io/) (i.e https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@eth2-beacon-prater.infura.io)
    required: false
  - notAllowed: random`;

      fs.writeFileSync(setupWizardPath, invalidSetupWizardString);

      expect(() => validateSetupWizardSchema(testDir)).to.throw();
    });

    it("should throw error with an empty service array in setupWizard", () => {
      const invalidSetupWizardString = `
version: "2"
fields:
  - id: GRAFFITI
    target:
      type: environment
      name: GRAFFITI
      service: []
    title: Graffiti
    maxLength: 32
    description: >-
      Add a string to your proposed blocks, which will be seen on the block explorer`;

      fs.writeFileSync(setupWizardPath, invalidSetupWizardString);

      expect(() => validateSetupWizardSchema(testDir)).to.throw();
    });

    it("should not throw with and empty setupWizard", () => {
      expect(() => validateSetupWizardSchema(undefined)).to.not.throw();
    });
  });
});
