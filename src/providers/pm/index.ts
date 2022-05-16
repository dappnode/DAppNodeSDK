import { Apm } from "./apm/Apm";
import { IPM } from "./interface";

export function getPM(provider: string): IPM {
  // TODO: Generalize with both APM and DPM
  // TODO: Find a way to switch between both:
  // - Pre-declared in the manifest?
  // - Check on chain in multiple providers?
  return new Apm(provider);
}
