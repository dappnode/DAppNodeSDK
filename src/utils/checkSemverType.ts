// Valid increase types for the Aragon Package Manager (APM)
// https://hack.aragon.org/docs/apm-ref.html
const validIncreaseTypes = ["major", "minor", "patch"];

export function checkSemverType(type: string): void {
  if (!validIncreaseTypes.includes(type)) {
    throw Error(
      `Semver increase type "${type}" is not valid. Must be one of: ${validIncreaseTypes.join(
        ", "
      )}`
    );
  }
}
