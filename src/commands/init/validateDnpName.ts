export function validateDnpName(name: string): void {
    if (!isValidDnpName(name))
        throw new Error("Invalid DAppNode package name. Expected format: <name>.<dnp|public>.dappnode.eth");
}

/**
 * Validates if a given dnpName follows the expected structure.
 * Expected format: <name>.<dnp|public>.dappnode.eth
 * 
 * @param {string} dnpName - The DAppNode package name to validate.
 * @returns {boolean} - Returns true if the dnpName is valid, false otherwise.
 */
function isValidDnpName(dnpName: string): boolean {
    const regex = /^[a-z0-9]+(-[a-z0-9]+)*\.(dnp|public)\.dappnode\.eth$/i;
    return regex.test(dnpName);
}