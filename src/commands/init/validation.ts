/**
 * Validates if a given dnpName follows the expected structure.
 * Expected format: <name>.<dnp|public>.dappnode.eth
 * 
 * @param {string} dnpName - The DAppNode package name to validate.
 * @returns {boolean} - Returns true if the dnpName is valid, false otherwise.
 */
export function isValidDnpName(dnpName: string): boolean {
    const regex = /^[a-z0-9]+(-[a-z0-9]+)*\.(dnp|public)\.dappnode\.eth$/i;
    return regex.test(dnpName);
}

export function validateDnpName(name: string): void {
    if (!isValidDnpName(name))
        throw new Error("Invalid DAppNode package name. Expected format: <name>.<dnp|public>.dappnode.eth");
}

export function validateVariantsInput(input: string): boolean | string {
    const variants = input.split(",").map(s => s.trim());
    const allNonEmpty = variants.every(variant => variant.length > 0);
    const uniqueVariants = new Set(variants).size === variants.length;

    if (variants.length < 2) {
        return "You need to specify at least two variants, separated by a comma. Example: mainnet,testnet";
    } else if (!allNonEmpty) {
        return "Empty variant detected. Please ensure all variants are non-empty.";
    } else if (!uniqueVariants) {
        return "Duplicate variants detected. Please ensure all variants are unique.";
    }
    return true;
}