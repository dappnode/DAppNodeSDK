/**
 * Pinata DAppNodePackage build pin metadata
 */
export interface DnpPinMetadata {
  dnpName: string;
  version: string;
  upstreamVersion: string | undefined;
  commit: string | undefined;
  branch: string | undefined;
}

export interface PinDataSummary {
  ipfsHash: string;
  commit?: string;
}

export interface PinsByBranch {
  branch: string;
  pins: PinDataSummary[];
}
