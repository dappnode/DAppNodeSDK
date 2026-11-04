import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { expect } from "chai";
import { readSetupWizardIfExists } from "../../src/files/setupWizard/readSetupWizardIfExists.js";
import { readNotificationsIfExists } from "../../src/files/notifications/readNotificationsIfExists.js";
import { temporaryDirectory } from "../helpers/fixtures.js";

describe("root and variant config merging", () => {
  let root: string;
  let variant: string;
  beforeEach(() => {
    root = temporaryDirectory();
    variant = path.join(root, "package_variants", "mainnet");
    fs.mkdirSync(variant, { recursive: true });
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("replaces arrays inside a setup-wizard field instead of merging them by index", () => {
    fs.writeFileSync(
      path.join(root, "setup-wizard.yml"),
      yaml.dump({
        version: "2",
        fields: [
          {
            id: "network",
            title: "Network",
            description: "Root description",
            enum: ["a", "b", "c"]
          }
        ]
      })
    );
    fs.writeFileSync(
      path.join(variant, "setup-wizard.yml"),
      yaml.dump({
        version: "2",
        fields: [{ id: "network", enum: ["mainnet"] }]
      })
    );
    const wizard = readSetupWizardIfExists([{ dir: root }, { dir: variant }]);
    expect(wizard?.fields).to.deep.equal([
      {
        id: "network",
        title: "Network",
        description: "Root description",
        enum: ["mainnet"]
      }
    ]);
  });

  it("replaces arrays inside a notification endpoint instead of merging them by index", () => {
    const endpoint = {
      name: "Health",
      enabled: true,
      url: "http://pkg.dappnode:8080",
      method: "GET",
      conditions: ["[STATUS] == 200", "[RESPONSE_TIME] < 500"],
      interval: "1m",
      group: "pkg",
      alerts: [],
      definition: { title: "Health", description: "Health check" },
      metric: { min: 0, max: 1, unit: "s" },
      correlationId: "pkg-health",
      isBanner: false
    };
    fs.writeFileSync(
      path.join(root, "notifications.yaml"),
      yaml.dump({ endpoints: [endpoint] })
    );
    fs.writeFileSync(
      path.join(variant, "notifications.yaml"),
      yaml.dump({
        endpoints: [
          { correlationId: "pkg-health", conditions: ["[STATUS] == 204"] }
        ]
      })
    );
    const notifications = readNotificationsIfExists([
      { dir: root },
      { dir: variant }
    ]);
    expect(notifications?.endpoints).to.deep.equal([
      { ...endpoint, conditions: ["[STATUS] == 204"] }
    ]);
  });
});
