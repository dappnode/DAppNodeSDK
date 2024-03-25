import { validateDnpName } from "./validateDnpName.js";

export function getShortDnpName(dnpName: string): string {
    validateDnpName(dnpName);
    return dnpName.split(".")[0];
}