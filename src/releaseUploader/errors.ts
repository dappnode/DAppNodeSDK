export class ReleaseUploaderConnectionError extends Error {
  ipfsProvider: string;
  reason: string;
  help?: string;
  constructor({
    ipfsProvider,
    reason,
    help
  }: {
    ipfsProvider: string;
    reason: string;
    help?: string;
  }) {
    super(`Can't connect to ${ipfsProvider}: ${reason}`);
    this.ipfsProvider = ipfsProvider;
    this.reason = reason;
    this.help = help;
  }
}
