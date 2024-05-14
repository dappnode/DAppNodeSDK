import { ApmRepository } from "@dappnode/toolkit";

export type Repo = Awaited<ReturnType<ApmRepository["getRepoContract"]>>;
