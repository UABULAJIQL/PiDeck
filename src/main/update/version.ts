import semver from "semver";

export function normalizeVersionLabel(version: string) {
	return version.trim().replace(/^v/i, "");
}

export function isNewerVersion(candidate: string | undefined, current: string | undefined) {
	if (!candidate || !current) return false;
	const candidateVersion = semver.coerce(normalizeVersionLabel(candidate));
	const currentVersion = semver.coerce(normalizeVersionLabel(current));
	if (!candidateVersion || !currentVersion) return false;
	return semver.gt(candidateVersion, currentVersion);
}
