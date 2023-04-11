import { Compose } from "../../../files/compose/types.js";

/**
 * Execute the tests for the integration test workflow. These tests require
 * a previous setup of the environment.
 * Tests to execute:
 * - Container status (running, healthy)
 * - No error logs after a timeout
 * - Healthcheck endpoint returns 200
 */
export async function executeTests({
  compose,
  errorLogsTimeout,
  healthCheckUrl
}: {
  compose: Compose;
  errorLogsTimeout?: number;
  healthCheckUrl?: string;
}): Promise<void> {
  await ensureContainerStatus();
  await ensureNoErrorLogs();
  await ensureHealthCheck();
}

async function ensureContainerStatus(): Promise<void> {
  // TODO
}

async function ensureNoErrorLogs(): Promise<void> {
  // TODO
}

async function ensureHealthCheck(): Promise<void> {
  // TODO
}
