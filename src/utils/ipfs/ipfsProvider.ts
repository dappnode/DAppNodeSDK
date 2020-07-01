import { URL } from "url";

function getIpfsProviderUrl(provider = "dappnode"): string {
  if (provider === "dappnode") {
    return "http://ipfs.dappnode";
  } else if (provider === "remote") {
    return "http://ipfs.dappnode.io";
  } else if (provider === "infura") {
    return "https://ipfs.infura.io";
  } else {
    return provider;
  }
}

function parseIpfsProviderUrl(provider: string) {
  if (provider.includes("://")) {
    // http://ipfs.dappnode
    // http://ipfs.dappnode:5002
    const [protocol, hostAndPort] = provider.split("://");
    const [host, port = 5001] = hostAndPort.split(":");
    return { host, port, protocol };
  } else {
    // ipfs.dappnode
    // ipfs.dappnode:5002
    const [host, port = 5001] = provider.split(":");
    return { host, port, protocol: "https" };
  }
}

export function normalizeIpfsProvider(provider: string): string {
  const providerUrl = getIpfsProviderUrl(provider);
  const { host, port, protocol } = parseIpfsProviderUrl(providerUrl);
  const fullUrl = `${protocol}://${host}:${port}`;
  // #### TEMP: Make sure the URL is correct
  new URL(fullUrl);
  return fullUrl;
}
