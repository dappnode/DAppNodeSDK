import { Compose } from "../releaseFiles/compose/types";
import { Manifest } from "../releaseFiles/manifest/types";

export type ReleaseFile =
  | { type: "compose"; data: Compose }
  | { type: "manifest"; data: Manifest }
  | { type: "setupWizard"; data: string | undefined };
