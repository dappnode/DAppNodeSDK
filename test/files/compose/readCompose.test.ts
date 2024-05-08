import { expect } from "chai";
import { Compose } from "@dappnode/types";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { cleanTestDir, testDir } from "../../testUtils.js";
import { readCompose } from "../../../src/files/index.js";

describe("files / readCompose", () => {
    before(() => {
        cleanTestDir(); // Clean up the test directory before each test
    });

    after(() => {
        cleanTestDir(); // Clean up the test directory after all tests are done
    });

    it("Should read and merge multiple compose files", () => {
        const composePaths = [
            { dir: testDir, composeFileName: "compose1.yml" },
            { dir: testDir, composeFileName: "compose2.yml" },
            { dir: testDir, composeFileName: "compose3.yml" }
        ];

        const compose1: Partial<Compose> = {
            version: "3.4",
            services: { service1: { image: "image1" } }
        };
        const compose2: Partial<Compose> = {
            version: "3.4",
            services: { service2: { image: "image2" } }
        };
        const compose3: Partial<Compose> = {
            version: "3.4",
            services: { service3: { image: "image3" } }
        };

        // Create test files
        fs.writeFileSync(path.join(testDir, "compose1.yml"), yaml.dump(compose1));
        fs.writeFileSync(path.join(testDir, "compose2.yml"), yaml.dump(compose2));
        fs.writeFileSync(path.join(testDir, "compose3.yml"), yaml.dump(compose3));

        // Call readCompose function
        const mergedCompose = readCompose(composePaths);

        // Expected merged compose
        const expectedCompose: Compose = {
            version: "3.4",
            services: {
                service1: { image: "image1" },
                service2: { image: "image2" },
                service3: { image: "image3" }
            }
        };

        // Assertions
        expect(mergedCompose).to.deep.equal(expectedCompose);
    });
});
