export class ReleaseUploaderConnectionError extends Error {
  url: string;
  reason: string;
  help?: string;
  constructor({
    url,
    reason,
    help
  }: {
    url: string;
    reason: string;
    help?: string;
  }) {
    super(`Can't connect to ${url}: ${reason}`);
    this.url = url;
    this.reason = reason;
    this.help = help;
  }
}
