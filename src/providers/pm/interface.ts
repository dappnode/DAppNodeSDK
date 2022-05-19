type SemverStr = string;

export type TxInputs = {
  dnpName: string;
  version: string;
  releaseMultiHash: string;
  developerAddress?: string;
};

export type TxSummary = {
  to: string;
  value: number;
  data: string;
  gasLimit: number;
};

export interface IPM {
  readonly ethProvider: string;

  getLatestVersion(dnpName: string): Promise<SemverStr>;
  // isRepoDeployed(dnpName: string): Promise<boolean>;

  /**
   * Tests if the connected JSON RPC is listening and available.
   * Uses the `net_listening` method.
   */
  isListening(): Promise<boolean>;

  populatePublishTransaction(inputs: TxInputs): Promise<TxSummary>;
}
