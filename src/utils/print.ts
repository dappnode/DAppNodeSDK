/**
 * Helper to print key value pairs in a custom format
 * @param obj
 * @param rowPrint
 */
export function printObject(
  obj: { [key: string]: string | number },
  rowPrint: (key: string, value: string | number) => string
): string {
  return Object.keys(obj)
    .map(key => rowPrint(key, obj[key]))
    .join("\n");
}
