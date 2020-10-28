export function getOperatingSystem(): string {
  const osType = process.platform;
  if (!osType) {
    // return default os to avoid crashes
    return "linux";
  }
  switch (osType) {
    case "aix":
      return "aix";
    case "darwin":
      return "darwin";
    case "win32":
      return "win32";
    case "freebsd":
      return "freebsd";
    case "openbsd":
      return "openbsd";
    case "sunos":
      return "sunos";
    case "linux":
      return "linux";
  }
  return "linux";
}
