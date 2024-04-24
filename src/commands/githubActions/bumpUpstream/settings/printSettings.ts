import { UpstreamSettings, GitSettings } from "../types.js";

export function printSettings(upstreamSettings: UpstreamSettings[], gitSettings: GitSettings, ethProvider: string): void {

    console.log(`
  
    Upstream Settings - ${JSON.stringify(upstreamSettings, null, 2)}
  
    Git Settings - ${JSON.stringify(gitSettings, null, 2)}
    
    ETH Provider - ${ethProvider}
  
    `);
}