import { app, Notification } from "electron";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ipcChannels } from "../../shared/ipc";
import type { AgentRuntimeState, AgentServerRequest, ChatMessage, AgentMessagePatch } from "../../shared/types";
import type { RpcServerRequest } from "./PiRpcClient";
import { formatBashToolMessage } from "./bashResult";
import { isInteractiveServerRequest, toAgentServerRequest } from "./serverRequestRouting";

export async function executeBashCommand(manager: any, agentId: any, command: any, excludeFromContext: any) {
		manager.addMessage(
			agentId,
			"user",
			`${excludeFromContext ? "!!" : "!"}${command}`,
		);
		const runtime = manager.requireRuntime(agentId);
		
		// 检查进程是否还活着
		if (!runtime.process.isRunning()) {
			runtime.tab.status = "error";
			manager.addMessage(
				agentId,
				"error",
				"Agent 进程已停止，请重启 Agent 后重试",
			);
			manager.emitState();
			return;
		}
		
		runtime.tab.status = "running";
		manager.emitState();

		try {
			const response = await runtime.process.client.request(
				{
					type: "bash",
					command,
					excludeFromContext,
				},
				60_000,
			);

			const data = response.data as
				| {
						output?: string;
						exitCode?: number;
						cancelled?: boolean;
						truncated?: boolean;
				  }
				| undefined;

			const output = data?.output ?? "";
			const exitCode = data?.exitCode ?? 0;
			const cancelled = data?.cancelled ?? false;

			if (cancelled) {
				manager.addMessage(agentId, "system", "命令已取消");
			} else {
				// 以 tool 消息展示命令输出，与 pi 终端的 bash 结果展示保持一致
				const toolMessage = formatBashToolMessage({
					command,
					output,
					exitCode,
					excludeFromContext,
				});
				manager.addMessage(agentId, "tool", toolMessage.text, toolMessage.meta);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const isProcessDead = errorMessage.includes("pi process is not running") || 
			                     errorMessage.includes("RPC command timed out");
			
			if (isProcessDead) {
				runtime.tab.status = "error";
				manager.addMessage(
					agentId,
					"error",
					errorMessage.includes("timed out") 
						? `命令执行超时，Agent 进程可能已停止。请重启 Agent 后重试。`
						: `Agent 进程已停止，请重启 Agent 后重试。`,
				);
			} else {
				manager.addMessage(
					agentId,
					"error",
					`命令执行失败：${errorMessage}`,
				);
			}
		} finally {
			if (runtime.tab.status !== "error") {
				runtime.tab.status = "idle";
			}
			manager.emitState();
		}
	}

export function handlePiEvent(manager: any, agentId: any, event: any) {
		// 通知本地监听器
		for (const listener of manager.localEventListeners) {
			try { listener(agentId, event); } catch {}
		}
		manager.emit(ipcChannels.agentsEvent, { agentId, event });

		if (!event || typeof event !== "object") return;
		const typed = event as Record<string, any>;
		const runtime = manager.agents.get(agentId);

		if (typed.type === "agent_start" && runtime) {
			runtime.tab.status = "running";
			manager.activeAssistantMessageIds.delete(agentId);
			manager.toolMessageIds.delete(agentId);
			manager.emitState();
		}

		if (typed.type === "message_start" && typed.message?.role === "assistant") {
			manager.beginAssistantMessage(agentId);
			manager.upsertAssistantMessage(agentId, typed.message);
		}

		if (typed.type === "auto_retry_start") {
			manager.upsertRetryStatusMessage(agentId, typed, "running");
			if (runtime) {
				// pi 在等待指数退避期间可能短暂结束一轮 agent run；桌面端保持 running，
				// 让用户明确知道当前不是最终失败，而是在等待下一次自动重试。
				runtime.tab.status = "running";
				manager.emitState();
			}
		}

		if (typed.type === "auto_retry_end") {
			manager.upsertRetryStatusMessage(
				agentId,
				typed,
				typed.success ? "success" : "error",
			);
		}

		if (typed.type === "agent_end") {
			manager.pendingUiSlashCommands.delete(agentId);
			// 即使 runtime 已被清理（如用户快速切换/停止 agent），仍需向会话写入错误提示，
			// 否则用户会看到发送后完全空白、没有任何反馈。
			if (runtime) {
				runtime.tab.status = "idle";
				// 清理流式思考状态
				manager.streamingThinking.delete(agentId);
				manager.activeAssistantMessageIds.delete(agentId);
				manager.toolMessageIds.delete(agentId);
				manager.emitThinking(agentId, "");
			}
			// agent 异常结束时（如 API 返回 400、模型报错等），将错误提示写入会话，避免用户看到空白。
			// 错误信息的存放位置因 pi 版本和错误类型不同而有多种可能：
			//   1. agent_end 顶层 errorMessage
			//   2. messages 数组中 stopReason=error 的消息的 errorMessage
			//   3. messages 数组中 assistant 消息的 content 里包含 error 片段
			//   4. agent_end 顶层 stopReason=error 但无 messages
			const agentMessages = Array.isArray(typed.messages) ? typed.messages : [];
			const errorMessages = agentMessages.filter(
				(m: any) => m.stopReason === "error",
			);
			// 逐级查找错误文本：顶层 → 错误消息列表 → 仅检查最后一轮对话中 type=error 的 content 块
			const topMsg = errorMessages[errorMessages.length - 1];
			// 只从最后一条 assistant 消息中查找显式 type=error 的 content 块，
			// 避免扫描全部历史消息导致工具成功输出被误判为错误。
			const lastAssistant = agentMessages
				.filter((m: any) => m.role === "assistant")
				.pop();
			const contentError = Array.isArray(lastAssistant?.content)
				? lastAssistant.content.find((c: any) => c?.type === "error")
				: undefined;
			const errorMsg =
				(typed.errorMessage as string | undefined) ??
				topMsg?.errorMessage ??
				(typed.error as string | undefined) ??
				(typeof contentError?.text === "string" ? contentError.text : undefined) ??
				(typeof contentError?.message === "string"
					? contentError.message
					: undefined);
			if (typed.willRetry === true) {
				// agent_end.willRetry 表示 pi 已判定本次错误会进入自动重试；
				// 此时不写入最终错误，避免用户误以为会话已经失败。
				if (errorMsg && !manager.retryStatusMessageIds.has(agentId)) {
					manager.upsertRetryStatusMessage(
						agentId,
						{
							attempt: 0,
							maxAttempts: 0,
							delayMs: 0,
							errorMessage: String(errorMsg),
						},
						"running",
					);
				}
			} else if (errorMsg) {
				manager.addDetailedErrorMessage(agentId, String(errorMsg));
			} else if (
				typed.stopReason === "error" ||
				errorMessages.length > 0
			) {
				manager.addDetailedErrorMessage(agentId, "Agent 返回未知错误，请重试");
			}
			if (runtime) manager.emitState();
			// 同步刷新 runtimeState，将 isStreaming 重置为 false；
			// 否则前端 isAgentBusy 依赖的 isStreaming 仍为过期的 true，导致排队 flush 无法触发。
			void manager.getRuntimeState(agentId)
				.then((state: any) => manager.emitIdleRuntimeState(agentId, state))
				.catch(() => manager.emitIdleRuntimeState(agentId));
			// 会话结束时发送系统通知，让用户知道 agent 已完成工作
			// 只在最后一条消息是 assistant 消息时通知，避免工具调用结束时也触发通知
			const messages = manager.messages.get(agentId) ?? [];
			const lastMessage = messages[messages.length - 1];
			if (lastMessage?.role === "assistant" && runtime) {
				manager.notifySessionEnd(runtime.tab.title);
			}
		}

		if (
			typed.type === "message_update" &&
			typed.assistantMessageEvent
		) {
			manager.handleAssistantMessageEvent(agentId, typed);
		}

		if (
			typed.type === "message_end" &&
			typed.message?.role === "assistant" &&
			manager.activeAssistantMessageIds.has(agentId)
		) {
			manager.upsertAssistantMessage(agentId, typed.message);
			manager.activeAssistantMessageIds.delete(agentId);
		}

		if (typed.type === "tool_execution_start") {
			manager.bashInputRequests.rememberCommand(agentId, typed);
			manager.upsertToolMessage(agentId, typed, "running");
			// 工具调用开始时确保 agent 状态为 running，保持 thinking bubble 显示
			if (runtime) {
				runtime.tab.status = "running";
				manager.emitState();
			}
		}

		if (typed.type === "tool_execution_end") {
			manager.bashInputRequests.clearToolCall(agentId, typed.toolCallId);
			manager.upsertToolMessage(
				agentId,
				typed,
				typed.isError ? "error" : "done",
			);
			// 工具调用完成后保持 agent 状态为 running，等待后续的 agent_end 事件
			// 这样在工具完成到 agent 生成回复之间，thinking bubble 仍然会显示
			if (runtime) {
				runtime.tab.status = "running";
				manager.emitState();
			}
		}

		if (typed.type === "tool_execution_update") {
			manager.bashInputRequests.rememberCommand(agentId, typed);
			manager.bashInputRequests.maybeEmitRequest(agentId, typed);
			manager.upsertToolMessage(agentId, typed, "running");
		}

		if (typed.type === "extension_error") {
			manager.addMessage(
				agentId,
				"error",
				String(typed.error ?? "Extension error"),
			);
		}
	}

export function emitIdleRuntimeState(manager: any, agentId: any, state: any) {
		manager.emit(ipcChannels.agentsRuntimeState, {
			agentId,
			state: {
				...(state ?? {}),
				isStreaming: false,
				isCompacting: false,
			},
		});
	}

export function handleServerRequest(manager: any, agentId: any, request: any) {
		const interactive = isInteractiveServerRequest(request);
		if (!interactive) {
			// notify / setStatus / setTitle 这类无响应 UI 事件可能在 agent_end 之后到达；
			// 它们只更新扩展侧 UI，不代表 Agent 仍在运行，不能把已完成会话重新置为 running。
			return;
		}
		const runtime = manager.agents.get(agentId);
		if (runtime) {
			runtime.tab.status = "running";
			manager.emitState();
		}
		let origin: AgentServerRequest["origin"] | undefined;
		if (request.type === "extension_ui_request") {
			const pendingUiSlash = manager.pendingUiSlashCommands.get(agentId);
			if (pendingUiSlash) {
				pendingUiSlash.sawUiRequest = true;
				origin = "uiSlashCommand";
				manager.removePendingUiSlashMessage(agentId, pendingUiSlash.command);
			}
		}
		manager.trackAndEmitServerRequest(agentId, request, origin);
	}

export function trackAndEmitServerRequest(manager: any, agentId: any, request: any, origin: any) {
		const requests = manager.pendingServerRequests.get(agentId) ?? new Map<string, RpcServerRequest>();
		requests.set(String(request.id), request);
		manager.pendingServerRequests.set(agentId, requests);
		const viewRequest = toAgentServerRequest(agentId, request);
		if (origin) viewRequest.origin = origin;
		manager.emit(ipcChannels.agentsEvent, {
			agentId,
			event: {
				type: "server_request",
				request: viewRequest,
			},
		});
	}

export function removePendingUiSlashMessage(manager: any, agentId: any, command: any) {
		const list = manager.messages.get(agentId);
		if (!list) return false;
		const lastUserIndex = [...list]
			.map((message: any, index: any) => ({ message, index }))
			.reverse()
			.find(({ message }) => message.role === "user")?.index;
		if (lastUserIndex == null) return false;
		if (list[lastUserIndex]?.text.trim() !== command) return false;
		const [removed] = list.splice(lastUserIndex, 1);
		if (!removed) return false;
		manager.messages.set(agentId, list);
		manager.refreshAutoTitle(agentId);
		manager.emitMessagePatch(agentId, { agentId, message: removed, op: "remove" });
		return true;
	}

export function cancelServerRequest(manager: any, agentId: any, requestId: any) {
		const requests = manager.pendingServerRequests.get(agentId);
		const request = requests?.get(requestId);
		const hadRequest = requests?.delete(requestId) === true;
		if (request?.type === "extension_ui_request") manager.pendingUiSlashCommands.delete(agentId);
		if (requests?.size === 0) manager.pendingServerRequests.delete(agentId);
		if (hadRequest) {
			manager.emit(ipcChannels.agentsEvent, {
				agentId,
				event: {
					type: "server_request_cancelled",
					requestId,
				},
			});
		}
	}

export function handleAssistantMessageEvent(manager: any, agentId: any, event: any) {
		const assistantEvent = event.assistantMessageEvent as Record<string, any>;
		const eventType = assistantEvent.type as string | undefined;
		const partialMessage =
			event.message ??
			assistantEvent.message ??
			assistantEvent.partial ??
			assistantEvent.partialMessage;

		if (eventType === "start" || eventType === "message_start") {
			manager.beginAssistantMessage(agentId);
			manager.upsertAssistantMessage(agentId, partialMessage);
			return;
		}

		if (eventType === "text_start" || eventType === "text_end") {
			manager.upsertAssistantMessage(agentId, partialMessage);
			return;
		}

		if (eventType === "text_delta") {
			manager.upsertAssistantMessage(
				agentId,
				partialMessage,
				String(assistantEvent.delta ?? ""),
			);
			return;
		}

		if (eventType === "thinking_delta") {
			const prev = manager.streamingThinking.get(agentId) ?? "";
			const delta = String(assistantEvent.delta ?? "");
			manager.streamingThinking.set(agentId, prev + delta);
			manager.emitThinking(agentId, manager.stripAnsi(prev + delta));
			manager.upsertAssistantMessage(agentId, partialMessage);
			return;
		}

		if (eventType === "thinking_end") {
			const finalThinking = String(
				assistantEvent.content ?? manager.streamingThinking.get(agentId) ?? "",
			);
			if (finalThinking) {
				manager.streamingThinking.set(agentId, finalThinking);
			}
			manager.upsertAssistantMessage(agentId, partialMessage);
			return;
		}

		if (eventType === "message_end" || eventType === "done" || eventType === "error") {
			manager.upsertAssistantMessage(agentId, partialMessage);
			manager.activeAssistantMessageIds.delete(agentId);
		}
	}

export function beginAssistantMessage(manager: any, agentId: any) {
		if (!manager.activeAssistantMessageIds.has(agentId)) {
			manager.activeAssistantMessageIds.set(agentId, randomUUID());
		}
	}

export function upsertAssistantMessage(manager: any, agentId: any, partialMessage: any, fallbackDelta: any) {
		const list = manager.messages.get(agentId) ?? [];
		let messageId = manager.activeAssistantMessageIds.get(agentId);
		if (!messageId) {
			messageId = randomUUID();
			manager.activeAssistantMessageIds.set(agentId, messageId);
		}

		const existing = list.find((message: any) => message.id === messageId);
		const extractedText =
			partialMessage && typeof partialMessage === "object"
				? manager.extractText((partialMessage as any).content)
				: "";
		const extractedThinking =
			partialMessage && typeof partialMessage === "object"
				? manager.extractThinking((partialMessage as any).content)
				: "";
		const pendingThinking = manager.streamingThinking.get(agentId);
		const nextThinking = manager.stripAnsi(extractedThinking || pendingThinking || "");

		if (existing) {
			existing.text = extractedText || `${existing.text}${fallbackDelta}`;
			if (nextThinking) existing.thinking = nextThinking;
			existing.timestamp = Date.now();
		} else {
			const text = extractedText || fallbackDelta;
			if (!text) return;
			list.push({
				id: messageId,
				agentId,
				role: "assistant",
				text,
				timestamp: Date.now(),
				...(nextThinking ? { thinking: nextThinking } : {}),
			});
		}

		if (nextThinking && (extractedText || fallbackDelta)) {
			manager.streamingThinking.delete(agentId);
			manager.emitThinking(agentId, "");
		}

		manager.messages.set(agentId, list);
		manager.emitMessagePatch(agentId, { agentId, message: existing ?? list[list.length - 1]! });
	}

export function upsertToolMessage(manager: any, agentId: any, event: any, status: any) {
		const toolName = event.toolName || "tool";
		const toolCallId = String(event.toolCallId ?? `${toolName}-${Date.now()}`);
		let agentTools = manager.toolMessageIds.get(agentId);
		if (!agentTools) {
			agentTools = new Map<string, string>();
			manager.toolMessageIds.set(agentId, agentTools);
		}

		let messageId = agentTools.get(toolCallId);
		if (!messageId) {
			messageId = randomUUID();
			agentTools.set(toolCallId, messageId);
		}

		const list = manager.messages.get(agentId) ?? [];
		const existing = list.find((message: any) => message.id === messageId);
		const isError = status === "error" || event.isError === true;
		const args = event.args ?? existing?.meta?.args;

		// 工具首次开始执行（status === "running"）且 args 携带文件路径时，
		// 读取文件原始内容以供差异编辑器使用。读取失败（文件不存在等）静默跳过。
		// 后续 done/error 状态复用已有的 originalContent，避免重复读取。
		let originalContent: string | undefined = existing?.meta?.originalContent as
			| string
			| undefined;
		if (
			status === "running" &&
			!originalContent &&
			typeof args === "object" &&
			args !== null
		) {
			const filePath =
				typeof (args as any).filePath === "string"
					? (args as any).filePath
					: typeof (args as any).path === "string"
						? (args as any).path
						: undefined;
			if (filePath) {
				readFile(filePath, "utf8")
					.then((content: any) => {
						originalContent = content;
						if (existing?.meta) {
							existing.meta.originalContent = content;
							manager.emitMessagePatch(agentId, { agentId, message: existing });
						}
					})
					.catch(() => {
						// 文件不存在或被删除，跳过
					});
			}
		}
		const result =
			event.result ??
			event.partialResult ??
			event.output ??
			existing?.meta?.result;
		const detailText = manager.formatToolDetail(
			toolName,
			args,
			result,
			isError,
		);
		const icon = status === "running" ? "▶" : isError ? "✗" : "✓";
		const text =
			status === "running" ? `${icon} ${toolName}` : `${icon} ${toolName}`;
		const meta = {
			status,
			toolName,
			toolCallId,
			args,
			result,
			isError,
			detailText,
			originalContent,
		};

		if (existing) {
			existing.text = text;
			existing.timestamp = Date.now();
			existing.meta = meta;
		} else {
			list.push({
				id: messageId,
				agentId,
				role: "tool",
				text,
				timestamp: Date.now(),
				meta,
			});
		}

		manager.messages.set(agentId, list);
		manager.emitMessagePatch(agentId, { agentId, message: existing ?? list[list.length - 1]! });
	}

export function addMessage(manager: any, agentId: any, role: any, text: any, meta: any, images: any) {
		const list = manager.messages.get(agentId) ?? [];
		const message = {
			id: randomUUID(),
			agentId,
			role,
			text,
			timestamp: Date.now(),
			meta,
			...(images && images.length > 0 ? { images } : {}),
		};
		list.push(message);
		manager.messages.set(agentId, list);
		if (role === "user" || role === "assistant") manager.refreshAutoTitle(agentId);
		manager.emitMessagePatch(agentId, { agentId, message });
	}

export function refreshAutoTitle(manager: any, agentId: any) {
		const runtime = manager.agents.get(agentId);
		if (!runtime) return false;
		const project = manager.getProject(runtime.tab.projectId);
		if (!project) return false;
		if (!manager.isDefaultAgentTitle(runtime.tab.title, project)) return false;
		const nextTitle = manager.inferTitleFromMessages(manager.messages.get(agentId) ?? []);
		if (!nextTitle || nextTitle === runtime.tab.title) return false;
		// Agent 列表标题应和历史会话列表的“摘要名”一致；
		// 只覆盖默认标题，避免打开/重命名过的历史会话名称被第一条消息反向改掉。
		runtime.tab.title = nextTitle;
		manager.emitState();
		return true;
	}

export function isDefaultAgentTitle(manager: any, title: any, project: any) {
		return (
			title === `${project.name} agent` ||
			title === `${project.name} 历史会话` ||
			title === "历史会话"
		);
	}

export function inferTitleFromMessages(manager: any, messages: any) {
		const firstUserText = messages.find((message: any) => message.role === "user")?.text;
		const firstAssistantText = messages.find(
			(message: any) => message.role === "assistant",
		)?.text;
		return manager.cleanTitle(firstUserText) || manager.cleanTitle(firstAssistantText);
	}

export function cleanTitle(manager: any, value: any) {
		const text = value?.replace(/\s+/g, " ").trim();
		if (!text || /^untitled$/i.test(text)) return undefined;
		return text.length > 32 ? `${text.slice(0, 32)}…` : text;
	}

export function addDetailedErrorMessage(manager: any, agentId: any, errorMessage: any) {
		const retryMessageId = manager.retryStatusMessageIds.get(agentId);
		const retryMessage = retryMessageId
			? manager.messages.get(agentId)?.find((message: any) => message.id === retryMessageId)
			: undefined;
		const attempt = Number(retryMessage?.meta?.attempt ?? 0);
		const maxAttempts = Number(retryMessage?.meta?.maxAttempts ?? 0);
		const retryLine = maxAttempts > 0 ? `\n\n已自动重试：${attempt}/${maxAttempts} 次` : "";
		// 最终失败时把重试次数和原始错误放在同一条错误消息里，便于用户复制给模型/服务商排查。
		manager.addMessage(agentId, "error", `请求失败。${retryLine}\n\n原因：${errorMessage}`);
	}

export function upsertRetryStatusMessage(manager: any, agentId: any, event: any, status: any) {
		const list = manager.messages.get(agentId) ?? [];
		let messageId = manager.retryStatusMessageIds.get(agentId);
		let message = messageId ? list.find((item: any) => item.id === messageId) : undefined;
		if (!message) {
			messageId = randomUUID();
			message = {
				id: messageId,
				agentId,
				role: "system",
				text: "",
				timestamp: Date.now(),
			};
			list.push(message);
			manager.retryStatusMessageIds.set(agentId, messageId);
		}

		const attempt = Number(event.attempt ?? message.meta?.attempt ?? 0);
		const maxAttempts = Number(event.maxAttempts ?? message.meta?.maxAttempts ?? 0);
		const delayMs = Number(event.delayMs ?? 0);
		const reason = String(
			event.errorMessage ?? event.finalError ?? message.meta?.errorMessage ?? "未知错误",
		);
		const delayText = delayMs > 0 ? `，${Math.ceil(delayMs / 1000)} 秒后重试` : "";
		const countText = maxAttempts > 0 ? `${attempt}/${maxAttempts}` : String(attempt || 1);

		if (status === "running") {
			message.text = `正在自动重试 ${countText}${delayText}\n原因：${reason}`;
		} else if (status === "success") {
			message.text = `自动重试成功，共重试 ${attempt} 次`;
		} else {
			message.text = `自动重试失败，已重试 ${countText} 次\n原因：${reason}`;
		}
		message.timestamp = Date.now();
		message.meta = { status, attempt, maxAttempts, delayMs, errorMessage: reason };

		manager.messages.set(agentId, list);
		manager.emitMessagePatch(agentId, { agentId, message });
	}

export function notifySessionEnd(manager: any, sessionTitle: any) {
		try {
			const settings = manager.settingsStore.get();
			if (!settings.enableNotifications) return;
			if (!Notification.isSupported()) return;

			// 使用应用名称作为通知标题，在 Windows/macOS 通知中心中显示为应用标识
			const appName = app.getName();
			const notification = new Notification({
				title: appName,
				body: `${sessionTitle} 已完成响应`,
				silent: false,
			});
			notification.show();
		} catch {
			// 通知失败不影响主流程，静默处理
		}
	}
