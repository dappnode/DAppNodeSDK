import { buildHandler } from "./commands/build";
import { fromGithubHandler } from "./commands/from_github";
import { increaseHandler } from "./commands/increase";
import { nextHandler } from "./commands/next";
import { publishHanlder } from "./commands/publish";

export const dappnodesdk = {
  build: buildHandler,
  publish: publishHanlder,
  fromGithub: fromGithubHandler,
  increase: increaseHandler,
  next: nextHandler
};
