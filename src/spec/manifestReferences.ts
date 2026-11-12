import { Compose, GLOBAL_ENVS, Manifest } from "@dappnode/types";

interface ManifestReferenceFinding {
  rule: "SPEC-M10" | "SPEC-M11";
  field: string;
  message: string;
}

const globalEnvPrefix = "_DAPPNODE_GLOBAL_";
// The installer prefixes manifest envs before looking them up in this catalogue.
// Use values rather than keys: ACTIVE, for example, maps to ENVS_ACTIVE.
const globalEnvNames = new Set(
  Object.values(GLOBAL_ENVS).map(name => name.slice(globalEnvPrefix.length))
);

/** Checks the resolved manifest against its resolved compose, after variant merging. */
export function checkManifestReferences(
  manifest: Manifest,
  compose: Compose
): ManifestReferenceFinding[] {
  const findings: ManifestReferenceFinding[] = [];
  const services = new Set(Object.keys(compose.services || {}));
  const checkService = (field: string, value: unknown) => {
    // Schema validation owns malformed values; spec checks must not throw first.
    if (typeof value === "string" && !services.has(value))
      findings.push({
        rule: "SPEC-M10",
        field,
        message: `${field} refers to service "${value}", which is not in the compose.`
      });
  };

  checkService("mainService", manifest.mainService);
  if (manifest.chain && typeof manifest.chain === "object")
    checkService("chain.serviceName", manifest.chain.serviceName);
  if (Array.isArray(manifest.backup))
    manifest.backup.forEach((entry, i) =>
      checkService(`backup[${i}].service`, entry?.service)
    );

  if (Array.isArray(manifest.globalEnvs))
    manifest.globalEnvs.forEach((entry, i) => {
      if (Array.isArray(entry?.services))
        entry.services.forEach((service, j) =>
          checkService(`globalEnvs[${i}].services[${j}]`, service)
        );
      if (Array.isArray(entry?.envs))
        entry.envs.forEach((env, j) => {
          if (typeof env !== "string" || globalEnvNames.has(env)) return;
          const shortName = env.startsWith(globalEnvPrefix)
            ? env.slice(globalEnvPrefix.length)
            : undefined;
          const suggestion =
            shortName && globalEnvNames.has(shortName)
              ? ` Use "${shortName}"; DAPPMANAGER adds ${globalEnvPrefix} when installing.`
              : " Use a short name from the shared GLOBAL_ENVS catalogue.";
          const field = `globalEnvs[${i}].envs[${j}]`;
          findings.push({
            rule: "SPEC-M11",
            field,
            message: `${field} requests unsupported global env "${env}".${suggestion}`
          });
        });
    });

  return findings;
}

/** Used to attribute an inherited reference to the source fragment that defines it. */
export function manifestFieldIsDefined(
  manifest: Partial<Manifest>,
  field: string
): boolean {
  let value: unknown = manifest;
  for (const key of field.replace(/\[(\d+)\]/g, ".$1").split(".")) {
    if (
      value === null ||
      typeof value !== "object" ||
      !Object.hasOwn(value, key)
    )
      return false;
    value = (value as Record<string, unknown>)[key];
  }
  return value !== undefined;
}
