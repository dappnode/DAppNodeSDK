import { TxData } from "../../types.js";

export interface ReleaseDetailsMap {
  [dnpName: string]: {
    nextVersion: string;
    releaseMultiHash: string;
    txData: TxData;
    releaseDir: string;
    variant: string;
  };
}
