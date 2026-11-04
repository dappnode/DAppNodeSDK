import { expect } from "chai";
import { validateNotificationsSchema } from "@dappnode/schemas";
import { validateReportingCoercions } from "../../../src/tasks/buildAndUpload/getFileValidationTask.js";

describe("schema coercion warnings", () => {
  it("reports values the schema validator coerced in place", () => {
    // DAppNodePackage-DMS ships `isBanner: "false"`, a truthy string for consumers.
    const notifications = {
      endpoints: [
        {
          name: "Health",
          enabled: true,
          url: "http://pkg.dappnode:8080",
          method: "GET",
          conditions: ["[STATUS] == 200"],
          interval: "1m",
          group: "pkg",
          priority: "medium",
          alerts: [
            {
              type: "custom",
              enabled: true,
              description: "Health failed",
              "failure-threshold": 2,
              "success-threshold": 1,
              "send-on-resolved": true
            }
          ],
          definition: { title: "Health", description: "Health check" },
          metric: { min: 0, max: 1, unit: "s" },
          correlationId: "pkg-health",
          isBanner: "false"
        }
      ]
    };
    const changes = validateReportingCoercions(
      "pkg notifications",
      notifications as never,
      validateNotificationsSchema
    );
    expect(notifications.endpoints[0].isBanner).to.equal(false);
    expect(changes).to.deep.equal([
      'pkg notifications endpoints.0.isBanner: "false" -> false'
    ]);
  });

  it("reports nothing when the source is already well typed", () => {
    const wizard = { version: "2", fields: [] };
    expect(
      validateReportingCoercions("pkg wizard", wizard, () => undefined)
    ).to.deep.equal([]);
  });
});
