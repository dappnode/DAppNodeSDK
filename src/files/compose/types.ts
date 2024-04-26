import { ComposeNetworks, ComposeService, ComposeVolumes } from "@dappnode/types";

export type OptionalComposeServiceProperties = Partial<Pick<ComposeService, 'image' | 'build'>>;
export type ComposeServiceFlexible = Omit<ComposeService, 'image' | 'build'> & OptionalComposeServiceProperties;

export interface FlexibleCompose {
    version: string;
    services: {
        [dnpName: string]: ComposeServiceFlexible;
    };
    networks?: ComposeNetworks;
    volumes?: ComposeVolumes;
}