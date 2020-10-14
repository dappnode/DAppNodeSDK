export function getSwarmGatewayUrl(provider = "dappnode"): string {
  if (provider === "dappnode") {
    return "http://swarm.dappnode";
  } else if (provider === "public") {
    return "https://swarm-gateways.net";
  } else {
    return provider;
  }
}
