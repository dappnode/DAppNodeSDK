export function parseCsv(s: string | string[] | undefined): string[] {
  if (Array.isArray(s)) return s;
  if (!s) return [];
  return s
    .split(",")
    .map(item => item.trim())
    .filter(item => item);
}
