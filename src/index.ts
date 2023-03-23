import { buildHandler } from "./commands/build.js";
import { fromGithubHandler } from "./commands/from_github.js";
import { increaseHandler } from "./commands/increase.js";
import { initHandler } from "./commands/init.js";
import { nextHandler } from "./commands/next.js";
import { publishHanlder } from "./commands/publish.js";

export const dappnodesdk = {
  build: buildHandler,
  fromGithub: fromGithubHandler,
  increase: increaseHandler,
  init: initHandler,
  next: nextHandler,
  publish: publishHanlder
};
