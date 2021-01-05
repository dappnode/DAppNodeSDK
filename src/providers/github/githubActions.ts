import fs from "fs";

/**
 * Returns Github Actions context.
 * From https://github.com/actions/toolkit/blob/c861dd8859fe5294289fcada363ce9bc71e9d260/packages/github/src/context.ts#L25
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getGithubContext() {
  return {
    // The name of the webhook event that triggered the workflow.
    eventName: process.env.GITHUB_EVENT_NAME as GithubWebhookEvent,
    // The commit SHA that triggered the workflow. For example,
    // ffac537e6cbbf934b08745a378932722df287a53.
    sha: process.env.GITHUB_SHA as string,
    // The branch or tag ref that triggered the workflow.
    // For example, refs/heads/feature-branch-1. If neither a branch or
    // tag is available for the event type, the variable will not exist.
    ref: process.env.GITHUB_REF as string,
    // The name of the person or app that initiated the workflow. For example, octocat.
    actor: process.env.GITHUB_ACTOR as string,
    // The name of the workflow.
    workflow: process.env.GITHUB_WORKFLOW as string,
    // The unique identifier (id) of the action.
    action: process.env.GITHUB_ACTION as string,
    job: process.env.GITHUB_JOB as string,
    runNumber: parseInt(process.env.GITHUB_RUN_NUMBER as string, 10),
    runId: parseInt(process.env.GITHUB_RUN_ID as string, 10)
  };
}

type GithubWebhookEvent =
  | "check_run"
  | "check_suite"
  | "create"
  | "delete"
  | "deployment"
  | "deployment_status"
  | "fork"
  | "gollum"
  | "issue_comment"
  | "issues"
  | "label"
  | "milestone"
  | "page_build"
  | "project"
  | "project_card"
  | "project_column"
  | "public"
  | "pull_request"
  | "pull_request_review"
  | "pull_request_review_comment"
  | "pull_request_target"
  | "push"
  | "registry_package"
  | "release"
  | "status"
  | "watch"
  | "workflow_run";

/**
 * Github actions store the event data payload at a JSON file with path
 * process.env.GITHUB_EVENT_PATH
 *
 * For example: '/home/runner/work/_temp/_github_workflow/event.json'
 *
 * The contents of the file are event dependant and equal to this docs
 * https://docs.github.com/en/free-pro-team@latest/developers/webhooks-and-events/webhook-events-and-payloads#webhook-payload-object-5
 *
 * For example (on delete):
 *
 * {
 *    "pusher_type": "user",
 *    "ref": "dapplion/branch-to-delete",
 *    "ref_type": "branch",
 *    "repository": { ... },
 *    "organization": { ... },
 *    "sender": { ... }
 * }
 */
export function getGithubEventData<T>(): T {
  if (!process.env.GITHUB_EVENT_PATH) {
    throw Error("Not in a Github Actions context, no GITHUB_EVENT_PATH");
  }

  return JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
}

export interface GithubActionsEventData {
  delete: {
    ref: string; // "dapplion/branch-to-delete"
    ref_type: string; // "branch"
    repository: GithubActionsRepository;
    organization: GithubActionsOrganization;
    sender: GithubActionsUser;
  };
  pull_request: {
    action: string; // The action that was performed
    number: number; // The pull request number
    pull_request: GithubActionsPullRequestObject;
    repository: GithubActionsRepository;
    organization: GithubActionsOrganization;
    sender: GithubActionsUser;
  };
  push: {
    ref: string; // The full git ref that was pushed, "refs/tags/simple-tag";
    before: string; // The SHA of the most recent commit on ref before the push, "6113728f27ae82c7b1a177c8d03f9e96e0adf246";
    after: string; // The SHA of the most recent commit on ref after the push, "0000000000000000000000000000000000000000";
    created: boolean;
    deleted: boolean;
    forced: boolean;
  };
}

interface GithubActionsRepository {
  id: number;
  full_name: string; // "dappnode/DAppNodeSDK"
}
type GithubActionsOrganization = {
  id: number;
  login: string; // dappnode
};
interface GithubActionsUser {
  id: number;
  login: string; // "dapplion";
}

interface GithubActionsPullRequestObject {
  head: GithubActionsPrBase;
  base: GithubActionsPrBase;
  draft: boolean;
  merged: boolean;
  repository: GithubActionsRepository;
  sender: GithubActionsUser;
}

interface GithubActionsPrBase {
  label: string; // `${userName}:${branchName}`,  "octocat:new-topic";
  ref: string; // branch name, "new-topic"
  sha: string; // head commit sha, "6dcb09b5b57875f334f61aebed695e2e4193db5e";
  user: GithubActionsUser;
}
