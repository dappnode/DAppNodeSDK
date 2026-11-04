import { cloneDeep, mergeWith } from "lodash-es";

/**
 * Deep merge where an array from a later source replaces the earlier array.
 * lodash `merge` combines arrays by index, so root `enum: [a, b, c]` plus a
 * variant `enum: [mainnet]` would become `[mainnet, b, c]`, which neither file declares.
 */
export function mergeReplacingArrays<T>(...sources: unknown[]): T {
  return mergeWith({}, ...sources, (_base: unknown, override: unknown) =>
    Array.isArray(override) ? cloneDeep(override) : undefined
  );
}
