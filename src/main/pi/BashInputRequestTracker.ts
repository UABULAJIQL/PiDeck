import type { RpcServerRequest } from "./PiRpcClient";

type ToolEvent = Record<string, any>;

type BashInputRequestCallbacks = {
	emitRequest: (agentId: string, request: RpcServerRequest) => void;
	cancelRequest: (agentId: string, requestId: string) => void;
};

type FallbackTimer = {
	timer: NodeJS.Timeout;
	signature: string;
};

type DetectedPrompt = {
	message: string;
	params?: Record<string, unknown>;
};

export class BashInputRequestTracker {
	private readonly pendingRequests = new Map<string, Set<string>>();
	private readonly fallbackTimers = new Map<string, Map<string, FallbackTimer>>();
	private readonly toolCommands = new Map<string, Map<string, string>>();

	constructor(private readonly callbacks: BashInputRequestCallbacks) {}

	rememberCommand(agentId: string, event: ToolEvent) {
		if (event.toolName !== "bash") return;
		const command = typeof event.args?.command === "string" ? event.args.command : "";
		if (!command) return;
		const toolCallId = this.getToolCallKey(event.toolCallId);
		let commands = this.toolCommands.get(agentId);
		if (!commands) {
			commands = new Map<string, string>();
			this.toolCommands.set(agentId, commands);
		}
		commands.set(toolCallId, command);
	}

	maybeEmitRequest(agentId: string, event: ToolEvent) {
		if (event.toolName !== "bash") return;
		const prompt = this.detectConfirmationPrompt(agentId, event);
		const toolCallId = event.toolCallId ?? "active";
		if (!prompt) {
			this.scheduleFallback(agentId, toolCallId, event);
			return;
		}
		this.clearFallbackTimer(agentId, toolCallId);
		this.emitRequest(agentId, toolCallId, prompt.message, prompt.params);
	}

	clearToolCall(agentId: string, toolCallId: unknown) {
		const requestId = this.getRequestId(toolCallId);
		this.clearRequestId(agentId, requestId);
		this.clearFallbackTimer(agentId, toolCallId);
		this.forgetCommand(agentId, toolCallId);
		this.callbacks.cancelRequest(agentId, requestId);
	}

	clearRequestId(agentId: string, requestId: string) {
		const pending = this.pendingRequests.get(agentId);
		pending?.delete(requestId);
		if (pending?.size === 0) this.pendingRequests.delete(agentId);
	}

	clearAgent(agentId: string) {
		const timers = this.fallbackTimers.get(agentId);
		for (const entry of timers?.values() ?? []) clearTimeout(entry.timer);
		this.fallbackTimers.delete(agentId);
		this.pendingRequests.delete(agentId);
		this.toolCommands.delete(agentId);
	}

	resolveResponse(decision: unknown) {
		const response =
			decision && typeof decision === "object"
				? (decision as Record<string, unknown>)
				: {};
		if (typeof response.input === "string") return response.input;
		if (response.confirmed === true || response.decision === "accept") return "y\n";
		return "n\n";
	}

	private getCommand(agentId: string, event: ToolEvent) {
		const command = typeof event.args?.command === "string" ? event.args.command : "";
		if (command) return command;
		return this.toolCommands.get(agentId)?.get(this.getToolCallKey(event.toolCallId)) ?? "";
	}

	private forgetCommand(agentId: string, toolCallId: unknown) {
		const commands = this.toolCommands.get(agentId);
		commands?.delete(this.getToolCallKey(toolCallId));
		if (commands?.size === 0) this.toolCommands.delete(agentId);
	}

	private emitRequest(
		agentId: string,
		toolCallId: unknown,
		prompt?: string,
		params?: Record<string, unknown>,
	) {
		const requestId = this.getRequestId(toolCallId);
		let pending = this.pendingRequests.get(agentId);
		if (!pending) {
			pending = new Set<string>();
			this.pendingRequests.set(agentId, pending);
		}
		if (pending.has(requestId)) return;
		pending.add(requestId);

		this.callbacks.emitRequest(agentId, {
			id: requestId,
			type: "bash_input_request",
			method: "bash_confirm",
			message: prompt,
			params,
		});
	}

	private detectConfirmationPrompt(agentId: string, event: ToolEvent): DetectedPrompt | undefined {
		const text = this.extractPromptText(event);
		const tail = this.stripAnsi(text).slice(-1200);
		const command = this.getCommand(agentId, event);
		if (!tail.trim()) return undefined;

		if (this.isYesNoSelectPrompt(tail)) {
			return {
				message: this.formatPromptMessage(tail),
				params: {
					inputMode: "yes_no_select",
					command: command || undefined,
				},
			};
		}

		const patterns = [
			/\[(?:[yY]\/?[nN]|[nN]\/?[yY])\]\s*$/,
			/\((?:[yY]\/?[nN]|[nN]\/?[yY])\)\s*$/,
			/(?:are you sure|do you want to continue|proceed|continue|confirm).{0,160}(?:\[(?:[yY]\/?[nN]|[nN]\/?[yY])\]|\((?:[yY]\/?[nN]|[nN]\/?[yY])\)|\?)/i,
			/(?:是否继续|确认|确定|继续).{0,80}[？?]\s*$/,
		];
		if (patterns.some((pattern) => pattern.test(tail))) {
			return { message: this.formatPromptMessage(tail) };
		}

		if (
			/\bpi(?:\.cmd)?\s+(?:install|remove)\b/i.test(command) &&
			/\b(?:Installing|Removing)\s+(?:npm|git|local):/i.test(tail)
		) {
			return { message: `${tail.trim()}\n\n${command}` };
		}

		return undefined;
	}

	private extractPromptText(value: unknown): string {
		if (typeof value === "string") return value;
		if (!value || typeof value !== "object") return "";
		const record = value as ToolEvent;
		const parts = [
			record.partialResult,
			record.result,
			record.output,
			record.text,
			record.content,
		]
			.map((item) => {
				if (typeof item === "string") return item;
				return this.extractToolResultText(item);
			})
			.filter(Boolean);
		return parts.join("\n") || JSON.stringify(value);
	}

	private scheduleFallback(agentId: string, toolCallId: unknown, event: ToolEvent) {
		const command = this.getCommand(agentId, event);
		const output = this.stripAnsi(this.extractPromptText(event)).trim();
		if (!this.shouldOfferFallback(command, output)) return;
		const key = this.getToolCallKey(toolCallId);
		const signature = `${command}\n${output.slice(-1200)}`;
		let timers = this.fallbackTimers.get(agentId);
		if (!timers) {
			timers = new Map<string, FallbackTimer>();
			this.fallbackTimers.set(agentId, timers);
		}
		const existing = timers.get(key);
		if (existing?.signature === signature) return;
		if (existing) clearTimeout(existing.timer);

		const timer = setTimeout(() => {
			timers?.delete(key);
			const params: Record<string, unknown> = {
				fallbackReason: "maybe_waiting_confirmation",
				command: command || undefined,
				output: output ? this.formatFallbackOutput(output) : undefined,
			};
			if (this.isYesNoSelectPrompt(output)) params.inputMode = "yes_no_select";
			this.emitRequest(agentId, toolCallId, undefined, params);
		}, 2500);
		timers.set(key, { timer, signature });
	}

	private shouldOfferFallback(command: string, output: string) {
		if (!command || !output) return false;
		if (this.isInteractiveRiskCommand(command)) return true;
		const tail = output.slice(-500);
		return (
			this.isYesNoSelectPrompt(tail) ||
			/(?:\[(?:[yY]\/?[nN]|[nN]\/?[yY])\]|\((?:[yY]\/?[nN]|[nN]\/?[yY])\))\s*$/.test(tail) ||
			/(?:是否继续|确认|确定|继续).{0,80}[？?]\s*$/.test(tail)
		);
	}

	private isYesNoSelectPrompt(output: string) {
		const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
		const recentLines = lines.slice(-12);
		const hasAllowQuestion = recentLines.some((line) => /^Allow\?$/i.test(line));
		if (!hasAllowQuestion) return false;
		const optionLines = recentLines.map((line) => line.replace(/^[→>›*•\-\s]+/, "").trim());
		return optionLines.some((line) => /^Yes$/i.test(line)) &&
			optionLines.some((line) => /^No$/i.test(line));
	}

	private formatPromptMessage(output: string) {
		return output.trim().split(/\r?\n/).slice(-12).join("\n");
	}

	private isInteractiveRiskCommand(command: string) {
		return (
			/\bpi(?:\.cmd)?\s+(?:install|remove)\b/i.test(command) ||
			/\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|remove|uninstall|approve-scripts)\b/i.test(command)
		);
	}

	private formatFallbackOutput(output: string) {
		return output
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)
			.filter((line) => line.length <= 180)
			.filter((line) => !/\bsrc[\\/].+:\d+:/i.test(line))
			.filter((line) => !/\b(?:confirmExtensionAction|confirmedByRenderer)\b/.test(line))
			.slice(-5)
			.join("\n");
	}

	private clearFallbackTimer(agentId: string, toolCallId: unknown) {
		const key = this.getToolCallKey(toolCallId);
		const timers = this.fallbackTimers.get(agentId);
		const timer = timers?.get(key);
		if (timer) clearTimeout(timer.timer);
		timers?.delete(key);
		if (timers?.size === 0) this.fallbackTimers.delete(agentId);
	}

	private extractToolResultText(value: unknown): string {
		if (typeof value === "string") return value;
		if (!value || typeof value !== "object") return "";
		if (Array.isArray(value)) {
			return value.map((item) => this.extractToolResultText(item)).filter(Boolean).join("\n");
		}
		const record = value as ToolEvent;
		const parts = [
			record.text,
			record.content,
			record.output,
			record.stdout,
			record.stderr,
			record.message,
		]
			.map((item) => this.extractToolResultText(item))
			.filter(Boolean);
		return parts.join("\n");
	}

	private stripAnsi(value: string) {
		return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
	}

	private getToolCallKey(toolCallId: unknown) {
		return String(toolCallId ?? "active");
	}

	private getRequestId(toolCallId: unknown) {
		return `bash:${this.getToolCallKey(toolCallId)}`;
	}
}
