import { buildHandler } from "./commands/build";
import { fromGithubHandler } from "./commands/from_github";
import { increaseHandler } from "./commands/increase";
import { initHandler } from "./commands/init";
import { nextHandler } from "./commands/next";
import { publishHanlder } from "./commands/publish";

export const dappnodesdk = {
  build: buildHandler,
  fromGithub: fromGithubHandler,
  increase: increaseHandler,
  init: initHandler,
  next: nextHandler,
  publish: publishHanlder
};
