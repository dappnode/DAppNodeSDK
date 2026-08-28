import { URL } from "url";
import dns from "dns";
import { promisify } from "util";
import { shell } from "../../utils/shell.js";

const dnsLookup = promisify(dns.lookup);

const DAPPNODE_IPFS_HOST = "ipfs.dappnode";
const DAPPNODE_IPFS_CONTAINER = "DAppNodeCore-ipfs.dnp.dappnode.eth";

/**
 * Check if a hostname can be resolved via DNS
 */
async function canResolveHost(hostname: string): Promise<boolean> {
  try {
    await dnsLookup(hostname);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the IP address of the IPFS container from Docker
 * @throws If the container does not exist or has no IP
 */
async function getIpfsContainerIp(): Promise<string> {
  const ip = await shell(
    `docker inspect ${DAPPNODE_IPFS_CONTAINER} --format '{{.NetworkSettings.Networks.dncore_network.IPAddress}}'`
  );

  if (!ip || ip.trim() === "") {
    throw new Error(
      `Could not get IP address for container ${DAPPNODE_IPFS_CONTAINER}`
    );
  }

  return ip.trim();
}

async function getIpfsProviderUrl(provider = "dappnode"): Promise<string> {
  if (provider === "dappnode") {
    // Try to resolve ipfs.dappnode first
    if (await canResolveHost(DAPPNODE_IPFS_HOST)) {
      return `http://${DAPPNODE_IPFS_HOST}`;
    }

    // Fallback to Docker container IP
    const containerIp = await getIpfsContainerIp();
    return `http://${containerIp}`;
  } else if (provider === "remote") {
    return "https://api.ipfs.dappnode.io";
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
    const defaultPort = protocol === "https" ? 443 : 5001;
    const [host, port = defaultPort] = hostAndPort.split(":");
    return { host, port, protocol };
  } else {
    // ipfs.dappnode
    // ipfs.dappnode:5002
    const [host, port = 443] = provider.split(":");
    return { host, port, protocol: "https" };
  }
}

export async function normalizeIpfsProvider(provider: string): Promise<string> {
  const providerUrl = await getIpfsProviderUrl(provider);
  const { host, port, protocol } = parseIpfsProviderUrl(providerUrl);
  const fullUrl = `${protocol}://${host}:${port}`;
  // #### TEMP: Make sure the URL is correct
  new URL(fullUrl);
  return fullUrl;
}
