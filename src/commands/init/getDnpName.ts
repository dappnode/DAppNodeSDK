import { publicRepoDomain, stringsToRemoveFromName } from "./params";

/**
* Parses a directory or generic package name and returns a full ENS guessed name
* @param name "DAppNodePackage-vipnode"
* @return "vipnode.public.dappnode.eth"
*/
export function getDnpName(name: string): string {
    // Remove prepended strings if any
    for (const stringToRemove of stringsToRemoveFromName)
        name = name.replace(stringToRemove, "");

    // Make name lowercase
    name = name.toLowerCase();

    // Append public domain
    return name.endsWith(".eth") ? name : name + publicRepoDomain;
}