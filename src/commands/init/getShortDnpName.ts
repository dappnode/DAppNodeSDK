import { validateDnpName } from "./validateDnpName";

export function getShortDnpName(dnpName: string): string {
    validateDnpName(dnpName);
    return dnpName.split(".")[0];
}