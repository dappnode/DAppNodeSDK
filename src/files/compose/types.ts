import { Compose, ComposeService } from "@dappnode/types";

export type OptionalComposeServiceProperties = Partial<
  Pick<ComposeService, "image" | "build">
>;
export type ComposeServiceFlexible = Omit<ComposeService, "image" | "build"> &
  OptionalComposeServiceProperties;

export interface FlexibleCompose extends Omit<Compose, "services"> {
  services: {
    [dnpName: string]: ComposeServiceFlexible;
  };
}
