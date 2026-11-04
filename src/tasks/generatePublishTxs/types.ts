import { ApmRepository } from "../../providers/apm/ApmRepository.js";

export type Repo = Awaited<ReturnType<ApmRepository["getRepoContract"]>>;
