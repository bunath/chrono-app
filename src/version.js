export function isNewerVersion(current, latest) {
  const parse = (version) =>
    version
      .replace(/^v/, "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);

  const [currentMajor, currentMinor, currentPatch] = parse(current);
  const [latestMajor, latestMinor, latestPatch] = parse(latest);

  if (latestMajor !== currentMajor) return latestMajor > currentMajor;
  if (latestMinor !== currentMinor) return latestMinor > currentMinor;
  return latestPatch > currentPatch;
}

if (typeof window !== "undefined") {
  window.isNewerVersion = isNewerVersion;
}
