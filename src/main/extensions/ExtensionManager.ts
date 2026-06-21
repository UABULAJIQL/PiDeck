import { spawn } from "node:child_process";
import type { AppSettings, PiExtensionListResult, PiExtensionSummary } from "../../shared/types";
import type { PiLocator } from "../pi/PiLocator";

type SettingsProvider = () => AppSettings;

/**
 * 通过 pi CLI 管理已安装扩展，避免桌面端直接改写 pi settings 导致和 CLI 行为不一致。
 * list/remove 都使用 --no-approve，防止配置弹窗因为项目级信任确认而阻塞。
 */
export class ExtensionManager {
	constructor(
		private readonly locator: PiLocator,
		private readonly getSettings: SettingsProvider,
	) {}

	async list(): Promise<PiExtensionListResult> {
		const raw = await this.runPi(["list", "--no-approve"], 20_000);
		return { extensions: this.parseListOutput(raw), raw };
	}

	async uninstall(source: string, scope: PiExtensionSummary["scope"] = "user"): Promise<void> {
		const normalized = source.trim();
		if (!normalized) throw new Error("扩展来源不能为空");
		await this.runPi([
			"remove",
			normalized,
			...(scope === "project" ? ["-l"] : []),
			"--no-approve",
		], 30_000);
	}

	async install(source: string): Promise<string> {
		const normalized = source.trim();
		if (!normalized) throw new Error("扩展名称不能为空");
		return this.runPi(["install", normalized, "--no-approve"], 60_000);
	}

	private async runPi(args: string[], timeout: number) {
		const command = this.locator.resolveCommand(this.getSettings().customPiPath);
		const invocation = this.locator.createInvocation(command, args);
		return new Promise<string>((resolve, reject) => {
			let stdout = "";
			let stderr = "";
			let timedOut = false;
			let settled = false;

			const child = spawn(invocation.command, invocation.args, {
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

	private parseListOutput(raw: string): PiExtensionSummary[] {
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
				pending = {
					id: `${scope}:${trimmed}`,
					source: trimmed,
					scope,
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
