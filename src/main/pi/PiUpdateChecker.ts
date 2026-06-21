import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
	AppSettings,
	PiPackageUpdateInfo,
	PiUpdateNoticeInfo,
	PiExtensionSummary,
} from "../../shared/types";
import { ExtensionManager } from "../extensions/ExtensionManager";
import { isNewerVersion, normalizeVersionLabel } from "../update/version";
import { PiLocator } from "./PiLocator";

type SettingsProvider = () => AppSettings;

type NpmPackageEntry = {
	source: string;
	displayName: string;
	packageName: string;
	currentVersion: string | undefined;
	scope: PiExtensionSummary["scope"];
};

type PiUpdateCache = {
	checkedAt: number;
	key: string;
	value: PiUpdateNoticeInfo;
};

const PI_LATEST_VERSION_URL = "https://pi.dev/api/latest-version";
const PI_CHANGELOG_URL = "https://pi.dev/changelog";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const FETCH_TIMEOUT_MS = 5000;
const PACKAGE_CHECK_CONCURRENCY = 4;

export class PiUpdateChecker {
	private readonly cachePath = join(app.getPath("userData"), "pi-update-cache.json");

	constructor(
		private readonly locator: PiLocator,
		private readonly extensionManager: ExtensionManager,
		private readonly getSettings: SettingsProvider,
	) {}

	async check(): Promise<PiUpdateNoticeInfo> {
		const currentVersion = await this.getCurrentPiVersion();
		const packages = await this.getInstalledNpmPackages();
		const key = buildCacheKey(currentVersion, packages);
		const cached = await this.readFreshCache(key);
		if (cached) return cached;

		const [latestVersion, packageUpdates] = await Promise.all([
			this.getLatestPiVersion(currentVersion),
			this.checkPackageUpdates(packages),
		]);
		const notice: PiUpdateNoticeInfo = {
			currentVersion,
			latestVersion,
			hasCoreUpdate: isNewerVersion(latestVersion, currentVersion),
			changelogUrl: PI_CHANGELOG_URL,
			packageUpdates,
			checkedAt: Date.now(),
		};
		await this.writeCache(key, notice);
		return notice;
	}

	private async getCurrentPiVersion() {
		try {
			const status = await this.locator.check(this.getSettings().customPiPath);
			if (status.installed && status.version) return normalizeVersionLabel(status.version);
		} catch {
			// 更新提醒不能影响主流程；pi 不可用或检测失败时只是不展示提醒。
		}
		return undefined;
	}

	private async getLatestPiVersion(currentVersion?: string) {
		if (!currentVersion || process.env.PI_OFFLINE || process.env.PI_SKIP_VERSION_CHECK) {
			return undefined;
		}
		try {
			const data = await fetchJsonWithTimeout<{ version?: unknown }>(PI_LATEST_VERSION_URL, {
				headers: {
					Accept: "application/json",
					"User-Agent": `pi-desktop/${app.getVersion()} pi/${currentVersion}`,
				},
			});
			return typeof data.version === "string" && data.version.trim()
				? normalizeVersionLabel(data.version)
				: undefined;
		} catch {
			return undefined;
		}
	}

	private async getInstalledNpmPackages() {
		if (process.env.PI_OFFLINE) return [];
		try {
			const result = await this.extensionManager.list();
			const entries = await Promise.all(
				result.extensions.map((extension) => this.toNpmPackageEntry(extension)),
			);
			return entries.filter((entry): entry is NpmPackageEntry => Boolean(entry));
		} catch {
			return [];
		}
	}

	private async toNpmPackageEntry(
		extension: PiExtensionSummary,
	): Promise<NpmPackageEntry | undefined> {
		const parsed = parseNpmSource(extension.source);
		if (!parsed || parsed.pinned || !extension.path) return undefined;
		const currentVersion = await readInstalledPackageVersion(extension.path);
		return {
			source: extension.source,
			displayName: parsed.packageName,
			packageName: parsed.packageName,
			currentVersion,
			scope: extension.scope,
		};
	}

	private async checkPackageUpdates(packages: NpmPackageEntry[]) {
		if (process.env.PI_OFFLINE || packages.length === 0) return [];
		const checks = packages.map(
			(entry) => async (): Promise<PiPackageUpdateInfo | undefined> => {
				if (!entry.currentVersion) return undefined;
				const latestVersion = await getLatestNpmVersion(entry.packageName);
				if (!latestVersion || !isNewerVersion(latestVersion, entry.currentVersion)) {
					return undefined;
				}
				return {
					source: entry.source,
					displayName: entry.displayName,
					currentVersion: entry.currentVersion,
					latestVersion,
					scope: entry.scope,
				};
			},
		);
		const updates = await runWithConcurrency(checks, PACKAGE_CHECK_CONCURRENCY);
		return updates.filter((update): update is PiPackageUpdateInfo => Boolean(update));
	}

	private async readFreshCache(key: string) {
		try {
			const cache = JSON.parse(await readFile(this.cachePath, "utf8")) as PiUpdateCache;
			if (cache.key === key && Date.now() - cache.checkedAt < CACHE_TTL_MS) {
				return cache.value;
			}
		} catch {
			// 缓存缺失或损坏时直接重新检查；更新提醒不应因为缓存问题失败。
		}
		return undefined;
	}

	private async writeCache(key: string, value: PiUpdateNoticeInfo) {
		try {
			await mkdir(app.getPath("userData"), { recursive: true });
			const cache: PiUpdateCache = { checkedAt: Date.now(), key, value };
			await writeFile(this.cachePath, JSON.stringify(cache, null, 2), "utf8");
		} catch {
			// 写缓存失败只影响下次是否复用网络结果，不影响本次提醒。
		}
	}
}

function parseNpmSource(source: string) {
	if (!source.startsWith("npm:")) return undefined;
	const spec = source.slice("npm:".length).trim();
	if (!spec) return undefined;
	const versionSeparator = spec.startsWith("@") ? spec.indexOf("@", spec.indexOf("/") + 1) : spec.indexOf("@");
	return {
		packageName: versionSeparator >= 0 ? spec.slice(0, versionSeparator) : spec,
		pinned: versionSeparator >= 0,
	};
}

async function readInstalledPackageVersion(packagePath: string) {
	try {
		const data = JSON.parse(await readFile(join(packagePath, "package.json"), "utf8")) as {
			version?: unknown;
		};
		return typeof data.version === "string" && data.version.trim()
			? normalizeVersionLabel(data.version)
			: undefined;
	} catch {
		return undefined;
	}
}

async function getLatestNpmVersion(packageName: string) {
	try {
		const encodedName = encodeURIComponent(packageName);
		const data = await fetchJsonWithTimeout<{ "dist-tags"?: { latest?: unknown } }>(
			`https://registry.npmjs.org/${encodedName}`,
			{ headers: { Accept: "application/json" } },
		);
		const latest = data["dist-tags"]?.latest;
		return typeof latest === "string" && latest.trim() ? normalizeVersionLabel(latest) : undefined;
	} catch {
		return undefined;
	}
}

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit = {}): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, { ...init, signal: controller.signal });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return (await response.json()) as T;
	} finally {
		clearTimeout(timer);
	}
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number) {
	const results: T[] = [];
	let nextIndex = 0;
	async function worker() {
		while (nextIndex < tasks.length) {
			const index = nextIndex;
			nextIndex += 1;
			results[index] = await tasks[index]();
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
	return results;
}

function buildCacheKey(currentVersion: string | undefined, packages: NpmPackageEntry[]) {
	const packageKey = packages
		.map((entry) => `${entry.source}@${entry.currentVersion ?? "unknown"}`)
		.sort()
		.join("|");
	return `${currentVersion ?? "unknown"}::${packageKey}`;
}
