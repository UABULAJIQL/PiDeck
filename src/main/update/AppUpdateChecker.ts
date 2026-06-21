import { app } from "electron";
import type { AppUpdateAsset, AppUpdateInfo } from "../../shared/types";
import { isNewerVersion, normalizeVersionLabel } from "./version";

export const RELEASES_URL = "https://github.com/ayuayue/pi-desktop/releases";

const LATEST_RELEASE_API =
	"https://api.github.com/repos/ayuayue/pi-desktop/releases/latest";

type GitHubReleaseAsset = {
	name: string;
	browser_download_url: string;
	size: number;
};

type GitHubRelease = {
	tag_name?: string;
	name?: string;
	body?: string;
	html_url?: string;
	published_at?: string;
	assets?: GitHubReleaseAsset[];
};

function selectRecommendedAsset(
	assets: AppUpdateAsset[],
	installationType?: "portable" | "installed",
) {
	const platform = process.platform;
	const arch = process.arch;
	// 安装包推荐必须同时考虑分发形态和 CPU 架构，否则自动更新提示可能给 Windows 便携版推荐安装器。
	const isPortable =
		installationType === "portable" ||
		(installationType === undefined && process.env.PORTABLE_EXECUTABLE_DIR !== undefined);

	const candidates = assets.map((asset) => ({
		...asset,
		lowerName: asset.name.toLowerCase(),
	}));

	const archKeywords =
		arch === "arm64" ? ["arm64", "aarch64"] : ["x64", "amd64", "x86_64"];
	const matchesArch = (name: string) =>
		archKeywords.some((keyword) => name.includes(keyword));

	const isWrongArch = (name: string) => {
		if (arch === "arm64") return /\b(x64|amd64|x86_64)\b/i.test(name);
		return /\b(arm64|aarch64)\b/i.test(name);
	};

	if (platform === "win32") {
		if (isPortable) {
			return (
				candidates.find(
					(asset) => asset.lowerName.endsWith(".zip") && matchesArch(asset.lowerName),
				) ??
				candidates.find(
					(asset) => asset.lowerName.endsWith(".zip") && !isWrongArch(asset.lowerName),
				) ??
				candidates.find(
					(asset) => asset.lowerName.endsWith(".exe") && matchesArch(asset.lowerName),
				) ??
				candidates.find(
					(asset) => asset.lowerName.endsWith(".exe") && !isWrongArch(asset.lowerName),
				)
			);
		}

		return (
			candidates.find(
				(asset) => asset.lowerName.endsWith(".exe") && matchesArch(asset.lowerName),
			) ??
			candidates.find(
				(asset) => asset.lowerName.endsWith(".exe") && !isWrongArch(asset.lowerName),
			) ??
			candidates.find(
				(asset) => asset.lowerName.endsWith(".zip") && matchesArch(asset.lowerName),
			) ??
			candidates.find(
				(asset) => asset.lowerName.endsWith(".zip") && !isWrongArch(asset.lowerName),
			)
		);
	}

	if (platform === "darwin") {
		return (
			candidates.find(
				(asset) => asset.lowerName.endsWith(".dmg") && matchesArch(asset.lowerName),
			) ??
			candidates.find(
				(asset) => asset.lowerName.endsWith(".dmg") && !isWrongArch(asset.lowerName),
			) ??
			candidates.find(
				(asset) => asset.lowerName.endsWith(".zip") && matchesArch(asset.lowerName),
			) ??
			candidates.find(
				(asset) => asset.lowerName.endsWith(".zip") && !isWrongArch(asset.lowerName),
			)
		);
	}

	if (platform === "linux") {
		return (
			candidates.find(
				(asset) => asset.lowerName.includes("appimage") && matchesArch(asset.lowerName),
			) ??
			candidates.find(
				(asset) => asset.lowerName.includes("appimage") && !isWrongArch(asset.lowerName),
			) ??
			candidates.find(
				(asset) => asset.lowerName.endsWith(".deb") && matchesArch(asset.lowerName),
			) ??
			candidates.find(
				(asset) => asset.lowerName.endsWith(".deb") && !isWrongArch(asset.lowerName),
			) ??
			candidates.find(
				(asset) => asset.lowerName.endsWith(".tar.gz") && matchesArch(asset.lowerName),
			) ??
			candidates.find(
				(asset) => asset.lowerName.endsWith(".tar.gz") && !isWrongArch(asset.lowerName),
			)
		);
	}

	return candidates.find((asset) => matchesArch(asset.lowerName)) ?? candidates[0];
}

export async function checkForAppUpdate(
	installationType?: "portable" | "installed",
): Promise<AppUpdateInfo> {
	const currentVersion = app.getVersion();
	const response = await fetch(LATEST_RELEASE_API, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": `pi-desktop/${currentVersion}`,
		},
	});
	if (!response.ok) throw new Error(`GitHub Release 检查失败：HTTP ${response.status}`);

	const release = (await response.json()) as GitHubRelease;
	const latestVersion = normalizeVersionLabel(release.tag_name || currentVersion);
	const assets = (release.assets ?? []).map((asset) => ({
		name: asset.name,
		url: asset.browser_download_url,
		size: asset.size,
	}));

	return {
		currentVersion,
		latestVersion,
		hasUpdate: isNewerVersion(latestVersion, currentVersion),
		releaseName: release.name || `v${latestVersion}`,
		releaseNotes: release.body || "",
		releaseUrl: release.html_url || RELEASES_URL,
		publishedAt: release.published_at,
		assets,
		recommendedAsset: selectRecommendedAsset(assets, installationType),
	};
}
