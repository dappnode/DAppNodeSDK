import tarFS from "tar-fs";
import got from "got";

function getSwarmGatewayUrl(provider = "dappnode") {
  if (provider === "dappnode") {
    return "http://swarm.dappnode";
  } else if (provider === "public") {
    return "https://swarm-gateways.net";
  } else {
    return provider;
  }
}

/**
 *
 * @param provider user selected provider. Possible values:
 * - null
 * - "dappnode"
 * - "infura"
 * - "localhost:5002"
 * - "ipfs.dappnode"
 * @return {Object} apm instance
 */
export class Swarm {
  url: string;

  constructor(provider: string) {
    this.url = getSwarmGatewayUrl(provider);
  }

  async addDirFromFs(path: string, onProgress: (percent: number) => void) {
    const res = await got({
      prefixUrl: this.url,
      url: "/bzz:/",
      method: "POST",
      headers: { "content-type": "application/x-tar" },
      body: tarFS.pack(path)
    }).on("uploadProgress", progress => {
      // Report upload progress
      // { percent: 0.9995998225975282, transferred: 733675762, total: 733969480 }
      if (onProgress) onProgress(progress.percent);
    });

    return res.body;
  }
}
