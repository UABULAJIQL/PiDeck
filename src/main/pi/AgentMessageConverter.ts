import { readFile, writeFile } from "node:fs/promises";
import type { ChatMessage, ImageAssetRef } from "../../shared/types";

export async function repairAssistantUsage(manager: any, sessionPath: any) {
		const raw = await readFile(sessionPath, "utf8").catch(() => "");
		if (!raw) return;

		let changed = false;
		const lines = raw.split(/\r?\n/).map((line: any) => {
			if (!line.trim()) return line;
			try {
				const entry = JSON.parse(line) as { message?: Record<string, any> };
				if (entry.message?.role !== "assistant") return line;

				const usage = entry.message.usage as Record<string, any> | undefined;
				if (usage?.totalTokens != null && usage.cost?.total != null) return line;

				// Codex 导入的旧会话缺少 assistant.usage；pi 的统计/压缩链路会直接读取 totalTokens，所以打开前补零值兼容。
				entry.message.usage = manager.normalizeUsage(usage);
				changed = true;
				return JSON.stringify(entry);
			} catch {
				return line;
			}
		});

		if (changed) await writeFile(sessionPath, lines.join("\n"), "utf8");
	}

export function normalizeUsage(manager: any, usage: any) {
		return {
			input: usage?.input ?? 0,
			output: usage?.output ?? 0,
			cacheRead: usage?.cacheRead ?? 0,
			cacheWrite: usage?.cacheWrite ?? 0,
			totalTokens:
				usage?.totalTokens ??
				(usage?.input ?? 0) +
					(usage?.output ?? 0) +
					(usage?.cacheRead ?? 0) +
					(usage?.cacheWrite ?? 0),
			cost: {
				input: usage?.cost?.input ?? 0,
				output: usage?.cost?.output ?? 0,
				cacheRead: usage?.cost?.cacheRead ?? 0,
				cacheWrite: usage?.cost?.cacheWrite ?? 0,
				total: usage?.cost?.total ?? 0,
			},
		};
	}

export function normalizeSessionPath(manager: any, sessionPath: any) {
		if (!sessionPath) return undefined;
		const normalized = sessionPath.replace(/\\/g, "/").replace(/\/+$/, "");
		return process.platform === "win32" ? normalized.toLowerCase() : normalized;
	}

export function getCreateDedupKey(manager: any, input: any) {
		const normalizedSessionPath = manager.normalizeSessionPath(input.sessionPath);
		return normalizedSessionPath
			? `${input.projectId}::session::${normalizedSessionPath}`
			: `${input.projectId}::new-session`;
	}

export async function convertAgentMessages(manager: any, agentId: any, rawMessages: any) {
		const historicalToolCalls = manager.collectHistoricalToolCalls(rawMessages);
		const groups = await Promise.all(
			rawMessages.map(async (message: any, index: number): Promise<ChatMessage[]> => {
				if (!message || typeof message !== "object") return [];
				const typed = message as any;
				if (typed.role === "user") {
					const images = await manager.extractImages(typed.content);
					return [
						{
							id: `${agentId}-history-${index}`,
							agentId,
							role: "user" as const,
							text:
								manager.extractText(typed.content) ||
								(images.length > 0 ? "[图片]" : ""),
							timestamp: typed.timestamp ?? Date.now(),
							...(images.length > 0 ? { images } : {}),
						},
					];
				}
				if (typed.role === "assistant") {
					const thinking = manager.extractThinking(typed.content);
					return [
						{
							id: `${agentId}-history-${index}`,
							agentId,
							role: "assistant" as const,
							text: manager.extractText(typed.content),
							timestamp: typed.timestamp ?? Date.now(),
							...(thinking ? { thinking } : {}),
						},
					];
				}
				if (typed.role === "toolResult") {
					const toolCallId = String(typed.toolCallId ?? `history-tool-${index}`);
					const historicalCall = historicalToolCalls.get(toolCallId);
					const toolName = String(typed.toolName ?? historicalCall?.name ?? "tool");
					const isError = Boolean(typed.isError);
					const result = {
						content: typed.content,
						details: typed.details,
					};
					const detailText = manager.formatToolDetail(
						toolName,
						historicalCall?.args,
						result,
						isError,
					);
					return [
						{
							id: `${agentId}-history-${index}`,
							agentId,
							role: "tool" as const,
							text: `${isError ? "✗" : "✓"} ${toolName}`,
							timestamp: typed.timestamp ?? Date.now(),
							meta: {
								status: isError ? "error" : "done",
								toolName,
								toolCallId,
								args: historicalCall?.args,
								result,
								isError,
								detailText,
							},
						},
					];
				}
				return [];
			}),
		);
		return groups.flat().filter((message: ChatMessage) => message.text.trim());
	}

export function collectHistoricalToolCalls(manager: any, rawMessages: any) {
		const calls = new Map<string, { name: string; args: unknown }>();
		for (const message of rawMessages) {
			if (!message || typeof message !== "object") continue;
			const typed = message as any;
			if (typed.role !== "assistant" || !Array.isArray(typed.content)) continue;
			for (const block of typed.content) {
				if (!block || typeof block !== "object") continue;
				const toolCall = block as any;
				if (toolCall.type !== "toolCall" || !toolCall.id) continue;
				// pi 的历史文件把工具参数保存在 assistant.content 的 toolCall 块中，
				// toolResult 只带结果；恢复历史详情时必须先建立 toolCallId → 参数映射。
				calls.set(String(toolCall.id), {
					name: String(toolCall.name ?? "tool"),
					args: toolCall.arguments,
				});
			}
		}
		return calls;
	}

export function formatToolDetail(manager: any, toolName: any, args: any, result: any, isError: any) {
		const details = manager.extractToolDetails(result);
		const sections = [
			`工具：${toolName ?? "tool"}`,
			`状态：${isError ? "失败" : "完成"}`,
			args ? `参数：\n${manager.safeJson(args)}` : "",
			result
				? `结果：\n${manager.extractToolResultText(result) || manager.safeJson(result)}`
				: "",
			details ? `详情：\n${manager.safeJson(details)}` : "",
		].filter(Boolean);
		return sections.join("\n\n");
	}

export function extractToolDetails(manager: any, result: any) {
		if (!result || typeof result !== "object") return undefined;
		return (result as any).details;
	}

export function extractToolResultText(manager: any, result: any) {
		if (!result || typeof result !== "object") return "";
		const content = (result as any).content;
		if (!Array.isArray(content)) return "";
		return content
			.map((item: any) => (typeof item?.text === "string" ? item.text : ""))
			.filter(Boolean)
			.join("\n");
	}

export function safeJson(manager: any, value: any) {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}

export function extractText(manager: any, content: any) {
		if (typeof content === "string") return content;
		if (Array.isArray(content))
			return content
				.map((item: any) => {
					if (typeof item === "string") return item;
					if (item && typeof item === "object") {
						const typed = item as any;
						// 跳过 thinking 和 image 类型的内容，只提取实际文本回复
						if (typed.type === "thinking" || typed.type === "image") return "";
						return String(typed.text ?? "");
					}
					return "";
				})
				.filter(Boolean)
				.join("\n");
		return "";
	}

export async function extractImages(manager: any, content: any) {
		if (!Array.isArray(content)) return [];
		const images = await Promise.all(
			content.map(async (item: any) => {
				if (!item || typeof item !== "object") return null;
				const typed = item as any;
				if (typed.type !== "image") return null;
				const data = typeof typed.data === "string" ? typed.data : "";
				const mimeType =
					typeof typed.mimeType === "string"
						? typed.mimeType
						: typeof typed.mime_type === "string"
							? typed.mime_type
							: "image/png";
				if (!data) return null;
				const asset = await manager.imageAssetStore.createFromBase64({ type: "image", data, mimeType });
				return {
					...asset,
					previewUrl: await manager.imageAssetStore.getFileUrl(asset),
				};
			}),
		);
		const filtered: ImageAssetRef[] = [];
		for (const image of images) {
			if (image) filtered.push(image);
		}
		return filtered;
	}

export async function resolvePromptImages(manager: any, images: any) {
		if (!images?.length) return undefined;
		const resolved = await Promise.all(
			images.map(async (image: any) => {
				if (image.type === "image") return image;
				return manager.imageAssetStore.readAsImageContent(image);
			}),
		);
		return resolved;
	}

export function extractThinking(manager: any, content: any) {
		if (!Array.isArray(content)) return "";
		const raw = content
			.map((item: any) => {
				if (!item || typeof item !== "object") return "";
				const typed = item as any;
				if (typed.type !== "thinking") return "";
				return String(typed.thinking ?? typed.text ?? "");
			})
			.filter(Boolean)
			.join("\n");
		return manager.stripAnsi(raw);
	}

export function stripAnsi(manager: any, text: any) {
		return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
	}
