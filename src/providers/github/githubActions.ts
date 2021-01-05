import fs from "fs";

// Github actions store the event data payload at a JSON file with path
// process.env.GITHUB_EVENT_PATH
//
// For example: '/home/runner/work/_temp/_github_workflow/event.json'
//
// The contents of the file are event dependant and equal to this docs
// https://docs.github.com/en/free-pro-team@latest/developers/webhooks-and-events/webhook-events-and-payloads#webhook-payload-object-5
//
// For example (on delete):
//
// {
//    "pusher_type": "user",
//    "ref": "dapplion/branch-to-delete",
//    "ref_type": "branch",
//    "repository": { ... },
//    "organization": { ... },
//    "sender": { ... }
// }

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
    sender: GithubActionsSender;
  };
  pull_request: {
    action: string; // The action that was performed
    number: number; // The pull request number
    pull_request: GithubActionsPullRequestObject;
    repository: GithubActionsRepository;
    organization: GithubActionsOrganization;
    sender: GithubActionsSender;
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
interface GithubActionsSender {
  id: number;
  login: string; // "dapplion";
}

interface GithubActionsPullRequestObject {
  head: {
    label: string; // "octocat:new-topic";
    ref: string; // "new-topic";
    sha: string; // "6dcb09b5b57875f334f61aebed695e2e4193db5e";
  };
}
