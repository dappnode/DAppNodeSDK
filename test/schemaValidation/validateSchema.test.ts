import { expect } from "chai";
import { Manifest, Compose } from "../../src/files";
import {
  validateComposeSchema,
  validateManifestSchema,
  validateSetupWizardSchema
} from "../../src/schemaValidation/validateSchema";
import fs from "fs";
import path from "path";
import { cleanTestDir, testDir } from "../testUtils";

describe("schemaValidation", () => {
  describe("manifest", () => {
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

    it("throw error validating", () => {
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
    it("should validate a valid compose", () => {
      const validCompose: Compose = {
        version: "3.5",
        services: {
          "dncore-node": {
            image: "dncore/dncore-node:latest",
            volumes: ["dncore_data:/some/path"],
            ports: ["30303:30303"]
          }
        },
        networks: {
          dncore_network: {
            external: true,
            driver: "bridge"
          }
        },
        volumes: { dncore_data: {} }
      };

      expect(() => validateComposeSchema(validCompose)).to.not.throw();
    });

    it("should throw error with an invalid compose", () => {
      const invalidCompose: Omit<Compose, "notAllowed"> & {
        notAllowed: string;
      } = {
        version: "3.5",
        services: {
          "dncore-node": {
            image: "dncore/dncore-node:latest",
            volumes: ["dncore_data:/some/path"],
            ports: ["30303:30303"]
          }
        },
        notAllowed: "random",
        networks: {
          dncore_network: {
            external: true,
            driver: "bridge"
          }
        },
        volumes: { dncore_data: {} }
      };

      expect(() => validateComposeSchema(invalidCompose)).to.throw();
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
      Add a string to your proposed blocks, which will be seen on the block explorer`

      fs.writeFileSync(setupWizardPath, invalidSetupWizardString);

      expect(() => validateSetupWizardSchema(testDir)).to.throw();
    });

    it("should not throw with and empty setupWizard", () => {
      expect(() => validateSetupWizardSchema(undefined)).to.not.throw();
    });
  });
});
