import { Manifest, Compose } from "@dappnode/types";
import { UpstreamSettings, GitSettings } from "../types.js";

export function printSettings(upstreamSettings: UpstreamSettings[], gitSettings: GitSettings, manifest: Manifest, compose: Compose, ethProvider: string): void {

    console.log(`
  
    Upstream Settings - ${JSON.stringify(upstreamSettings, null, 2)}
  
    Git Settings - ${JSON.stringify(gitSettings, null, 2)}
    
    Manifest - ${JSON.stringify(manifest, null, 2)}
    
    Compose - ${JSON.stringify(compose, null, 2)}
    
    ETH Provider - ${ethProvider}
  
    `);
}