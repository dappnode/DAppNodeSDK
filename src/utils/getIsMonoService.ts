import { Compose } from "../files";

export function getIsMonoService(compose: Compose): boolean {
  return Object.keys(compose.services).length === 1;
}
