import { Github } from "../../../providers/github/Github";
import { readManifest } from "../../../utils/manifest";
import {
  DNP_CORE_GITHUB_EVENT_TYPE,
  DNP_CORE_GITHUB_USER,
  DNP_CORE_GITHUB_REPO,
  DNP_CORE_DEPENDENCIES
} from "../../../params";

/**
 * Send a repository_dispatch event to the DNP_CORE Github repo only if:
 * - Current package is a dependency of DNP_CORE
 */
export async function triggerCoreDnpWorkflowMaybe({
  dir,
  releaseMultiHash,
  branch,
  commitSha
}: {
  dir: string;
  releaseMultiHash: string;
  branch: string;
  commitSha: string;
}): Promise<void> {
  const manifest = readManifest(dir);
  if (!DNP_CORE_DEPENDENCIES.includes(manifest.name)) {
    console.log(`Skipping triggerCoreDnpWorkflow for ${manifest.name}`);
    return;
  }

  const github = new Github({
    owner: DNP_CORE_GITHUB_USER,
    repo: DNP_CORE_GITHUB_REPO
  });

  const clientPayload = {
    releaseMultiHash,
    branch,
    commitSha
  };

  try {
    await github.dispatchEvent(DNP_CORE_GITHUB_EVENT_TYPE, clientPayload);
    console.log("Triggered DNP_CORE workflow");
  } catch (e) {
    console.log("Error on triggerCoreDnpWorkflow", e);
  }
}
