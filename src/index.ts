import { buildHandler } from "./commands/build";
import { fromGithubHandler } from "./commands/from_github";
import { initHandler } from "./commands/init";
import { listHandler } from "./commands/list";
import { publishHanlder } from "./commands/publish";
import { versionHandler } from "./commands/version";

export const dappnodesdk = {
  build: buildHandler,
  fromGithub: fromGithubHandler,
  init: initHandler,
  list: listHandler,
  publish: publishHanlder,
  version: versionHandler
};
