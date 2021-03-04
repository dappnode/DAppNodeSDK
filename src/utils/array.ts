/**
 * Returns true if array elements are unique (shallow)
 */
export function arrIsUnique<T>(arr: T[]): boolean {
  const unique = [...new Set(arr)];
  return unique.length === arr.length;
}
