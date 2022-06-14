/**
 * Returns the default dappnode values that
 */
export function getComposeDappnodeDefaults(): DappnodeDefaults {}

const getContainerName = ({
  dnpName,
  serviceName,
  isCore
}: {
  dnpName: string;
  serviceName: string;
  isCore: boolean;
}): string =>
  // Note: _PREFIX variables already end with the character "-"
  [
    isCore ? params.CONTAINER_CORE_NAME_PREFIX : params.CONTAINER_NAME_PREFIX,
    getContainerDomain({ dnpName, serviceName })
  ].join("");

/**
 * Get a unique domain per container, considering multi-service packages
 */
const getContainerDomain = ({
  dnpName,
  serviceName
}: {
  serviceName: string;
  dnpName: string;
}): string => {
  if (!serviceName || serviceName === dnpName) {
    return dnpName;
  } else {
    return [serviceName, dnpName].join(".");
  }
};

const getImageTag = ({
  dnpName,
  serviceName,
  version
}: {
  dnpName: string;
  serviceName: string;
  version: string;
}): string => [getContainerDomain({ dnpName, serviceName }), version].join(":");

/**
 * Parses an envs array from a manifest or docker-compose.yml
 * [NOTE]: protect against faulty lines: envsArray = [""], they can break a compose
 * - Filter by row.trim()
 * - Make sure the key is define before adding to the envs object
 * @param envsArray:
 * ["NAME=VALUE",  "NOVAL",   "COMPLEX=D=D=D  = 2"]
 * @returns envs =
 * { NAME: "VALUE", NOVAL: "", COMPLEX: "D=D=D  = 2" }
 */
export function parseEnvironment(
  envsArray: string[] | PackageEnvs
): PackageEnvs {
  // Make sure ENVs are in array format
  if (typeof envsArray === "object" && !Array.isArray(envsArray))
    return envsArray;

  return envsArray
    .filter(row => (row || "").trim())
    .reduce((envs: PackageEnvs, row) => {
      const [key, value] = (row || "").trim().split(/=(.*)/);
      return key ? { ...envs, [key]: value || "" } : envs;
    }, {});
}
