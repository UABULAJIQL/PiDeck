import { spawn } from "node:child_process";
import type { AppSettings, PiExtensionListResult, PiExtensionSummary } from "../../shared/types";
import type { PiSettings } from "../config/ConfigManager";
import type { PiLocator } from "../pi/PiLocator";

type SettingsProvider = () => AppSettings;
type PiSettingsReader = (projectPath?: string) => Promise<PiSettings>;
type PiSettingsWriter = (settings: PiSettings, projectPath?: string) => Promise<void>;
type PiPackageSettingsEntry = string | { source: string; extensions?: unknown; skills?: unknown; prompts?: unknown; themes?: unknown };

/**
 * 通过 pi CLI 管理已安装扩展，避免桌面端直接改写 pi settings 导致和 CLI 行为不一致。
 * list/remove 都使用 --no-approve，防止配置弹窗因为项目级信任确认而阻塞。
 */
export class ExtensionManager {
	constructor(
		private readonly locator: PiLocator,
		private readonly getSettings: SettingsProvider,
		private readonly readPiSettings: PiSettingsReader,
		private readonly writePiSettings: PiSettingsWriter,
	) {}

	async list(projectPath?: string): Promise<PiExtensionListResult> {
		const raw = await this.runPi(["list", "--no-approve"], 20_000, projectPath);
		const globalSettings = await this.readPiSettings();
		const projectSettings = projectPath ? await this.readPiSettings(projectPath) : undefined;
		return { extensions: this.parseListOutput(raw, globalSettings, projectSettings), raw };
	}

	async uninstall(
		source: string,
		scope: PiExtensionSummary["scope"] = "user",
		projectPath?: string,
	): Promise<void> {
		const normalized = source.trim();
		if (!normalized) throw new Error("扩展来源不能为空");
		const cwd = scope === "project" ? this.requireProjectPath(projectPath) : undefined;
		await this.runPi(
			[
				"remove",
				normalized,
				...(scope === "project" ? ["-l"] : []),
				"--no-approve",
			],
			30_000,
			cwd,
		);
	}

	async install(source: string): Promise<string> {
		const normalized = source.trim();
		if (!normalized) throw new Error("扩展名称不能为空");
		return this.runPi(["install", normalized, "--no-approve"], 60_000);
	}

	async setEnabled(
		source: string,
		scope: PiExtensionSummary["scope"] = "user",
		enabled: boolean,
		projectPath?: string,
	): Promise<void> {
		const normalized = this.normalizeListedSource(source);
		if (!normalized) throw new Error("扩展来源不能为空");
		const targetProjectPath = scope === "project" ? this.requireProjectPath(projectPath) : undefined;
		const settings = await this.readPiSettings(targetProjectPath);
		const nextPackages = this.updatePackageExtensionToggle(settings.packages, normalized, enabled);
		const updated: PiSettings = { ...settings, packages: nextPackages };
		await this.writePiSettings(updated, targetProjectPath);
	}

	private requireProjectPath(projectPath?: string) {
		const normalized = projectPath?.trim();
		if (!normalized) {
			throw new Error("项目级扩展需要先选择一个项目，才能定位对应的 .pi/settings.json。");
		}
		return normalized;
	}

	private getEnabledState(
		source: string,
		scope: PiExtensionSummary["scope"],
		globalSettings: PiSettings,
		projectSettings?: PiSettings,
		listedAsFiltered = false,
	) {
		const settings = scope === "project" ? projectSettings : globalSettings;
		if (!settings) return !listedAsFiltered;
		const packages = Array.isArray(settings.packages) ? settings.packages : [];
		const matched = this.findPackageEntry(packages, source);
		if (!matched) return !listedAsFiltered;
		if (typeof matched === "string") return true;
		const filters = matched.extensions;
		if (!Array.isArray(filters)) return true;
		return filters.length > 0;
	}

	private updatePackageExtensionToggle(rawPackages: unknown, source: string, enabled: boolean) {
		const packages = Array.isArray(rawPackages) ? [...rawPackages] : [];
		const index = this.findPackageIndex(packages, source);
		if (index < 0) {
			throw new Error(`未在 pi settings.packages 中找到扩展来源：${source}`);
		}
		const current = packages[index];
		if (enabled) {
			if (typeof current === "string") return packages;
			const next = { ...current };
			delete next.extensions;
			packages[index] = this.hasPackageFilters(next) ? next : next.source;
			return packages;
		}

		const normalized = typeof current === "string" ? { source: current } : { ...current };
		normalized.extensions = [];
		packages[index] = normalized;
		return packages;
	}

	private getPackageSource(entry: unknown) {
		if (typeof entry === "string") return entry;
		if (entry && typeof entry === "object" && "source" in entry && typeof entry.source === "string") {
			return entry.source;
		}
		return undefined;
	}

	private getNormalizedPackageSource(entry: unknown) {
		return this.normalizePackageSource(this.getPackageSource(entry));
	}

	private isPackageSettingsEntry(entry: unknown): entry is PiPackageSettingsEntry {
		return typeof entry === "string" || Boolean(this.getPackageSource(entry));
	}

	private findPackageEntry(packages: unknown[], source: string): PiPackageSettingsEntry | undefined {
		const matched = packages.find((entry) => this.getNormalizedPackageSource(entry) === source);
		return this.isPackageSettingsEntry(matched) ? matched : undefined;
	}

	private findPackageIndex(packages: unknown[], source: string) {
		return packages.findIndex((entry) => this.getNormalizedPackageSource(entry) === source);
	}

	private normalizePackageSource(source?: string) {
		return source?.trim();
	}

	private normalizeListedSource(line: string) {
		return line.trim().replace(/\s+\([^)]*\)\s*$/, "").trim();
	}

	private parsePackageListLine(line: string) {
		const trimmed = line.trim();
		return {
			source: this.normalizeListedSource(trimmed),
			filtered: /\(filtered\)\s*$/i.test(trimmed),
		};
	}

	private hasPackageFilters(entry: Record<string, unknown>) {
		return ["extensions", "skills", "prompts", "themes"].some((key) => Array.isArray(entry[key]));
	}

	private async runPi(args: string[], timeout: number, cwd?: string) {
		const command = this.locator.resolveCommand(this.getSettings().customPiPath);
		const invocation = this.locator.createInvocation(command, args);
		return new Promise<string>((resolve, reject) => {
			let stdout = "";
			let stderr = "";
			let timedOut = false;
			let settled = false;

			const child = spawn(invocation.command, invocation.args, {
				cwd,
				env: {
					...this.locator.createProcessEnv(this.getSettings(), invocation.pathPrefix),
					// 设置页扩展管理必须保持非交互，避免后台 CLI 等输入导致桌面端卡住。
					CI: "1",
					NO_COLOR: "1",
					npm_config_yes: "true",
					npm_config_audit: "false",
					npm_config_fund: "false",
					PI_OFFLINE: "1",
				},
				shell: invocation.shell,
				windowsHide: true,
				stdio: ["ignore", "pipe", "pipe"],
				windowsVerbatimArguments: invocation.windowsVerbatimArguments,
			});

			const capOutput = (current: string, chunk: Buffer) => {
				const next = current + chunk.toString("utf8");
				return next.length > 20_000 ? next.slice(-20_000) : next;
			};

			child.stdout?.on("data", (chunk: Buffer) => {
				stdout = capOutput(stdout, chunk);
			});
			child.stderr?.on("data", (chunk: Buffer) => {
				stderr = capOutput(stderr, chunk);
			});

			const finish = (error?: Error, output = stdout) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				if (error) {
					reject(error);
					return;
				}
				resolve(output);
			};

			const killProcessTree = () => {
				if (!child.pid) return;
				if (process.platform === "win32") {
					spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
						windowsHide: true,
						stdio: "ignore",
					});
					return;
				}
				child.kill("SIGKILL");
			};

			const timer = setTimeout(() => {
				timedOut = true;
				killProcessTree();
			}, timeout);

			child.on("error", (error) => {
				finish(new Error(error.message || "pi 扩展命令启动失败"));
			});

			child.on("close", (code, signal) => {
				if (timedOut) {
					const detail = (stderr || stdout).trim();
					finish(new Error(`pi 扩展命令超时${detail ? `：${detail}` : ""}`));
					return;
				}
				if (code !== 0) {
					const detail = (stderr || stdout || signal || `退出码 ${code}`).toString().trim();
					finish(new Error(detail || "pi 扩展命令执行失败"));
					return;
				}
				finish(undefined, stdout);
			});
		});
	}

	private parseListOutput(
		raw: string,
		globalSettings: PiSettings,
		projectSettings?: PiSettings,
	): PiExtensionSummary[] {
		const result: PiExtensionSummary[] = [];
		let scope: PiExtensionSummary["scope"] = "unknown";
		let pending: PiExtensionSummary | null = null;

		for (const line of raw.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			if (/^User packages:/i.test(trimmed)) {
				scope = "user";
				pending = null;
				continue;
			}
			if (/^Project packages:/i.test(trimmed)) {
				scope = "project";
				pending = null;
				continue;
			}

			if (/^(?:npm|file|github|git|https?):/i.test(trimmed)) {
				const listed = this.parsePackageListLine(trimmed);
				pending = {
					id: `${scope}:${listed.source}`,
					source: listed.source,
					scope,
					enabled: this.getEnabledState(
						listed.source,
						scope,
						globalSettings,
						projectSettings,
						listed.filtered,
					),
				};
				result.push(pending);
				continue;
			}

			if (pending && !pending.path) {
				pending.path = trimmed;
			}
		}

		return result;
	}
}
