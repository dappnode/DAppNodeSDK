export function check<T>(variable: T | null, name: string, type: string) {
  if (variable == null) {
    throw Error(`Variable ${name} must be defined`);
  } else if (type && typeof variable !== type) {
    throw Error(`Variable ${name} must be of type ${type}`);
  }
}
