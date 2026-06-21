import type { AgentServerRequest } from "../../shared/types";
import type { RpcServerRequest } from "./PiRpcClient";

const FIRE_AND_FORGET_METHODS = new Set([
	"notify",
	"setStatus",
	"setWidget",
	"setTitle",
	"set_editor_text",
]);

const EXTENSION_INTERACTIVE_METHODS = new Set(["confirm", "select", "input", "editor"]);
const APPROVAL_METHODS = new Set(["approve", "approval", "requestApproval", "request_approval", "confirm"]);

export function isInteractiveServerRequest(request: RpcServerRequest): boolean {
	if (request.type === "extension_ui_request") {
		return EXTENSION_INTERACTIVE_METHODS.has(request.method);
	}
	if (FIRE_AND_FORGET_METHODS.has(request.method)) return false;

	const params = (request.params ?? {}) as Record<string, unknown>;
	if (
		APPROVAL_METHODS.has(request.method) ||
		Array.isArray(params.availableDecisions) ||
		typeof params.command === "string" ||
		typeof params.reason === "string"
	) {
		return true;
	}

	// 带 id 的 JSON-RPC server request 除明确 status/UI 噪声外默认交给用户确认。
	// 上游审批字段名变化时，宁可弹出确认，也不能让 agent 停在等待响应的死锁状态。
	return true;
}

export function toAgentServerRequest(
	agentId: string,
	request: RpcServerRequest,
): AgentServerRequest {
	return {
		agentId,
		requestId: request.id,
		type: request.type,
		method: request.method,
		params: request.params,
		title: request.title,
		message: request.message,
		options: getStringOptions(request.options),
		timeout: typeof request.timeout === "number" ? request.timeout : undefined,
	};
}

function getStringOptions(options: unknown) {
	if (!Array.isArray(options)) return undefined;
	return options.filter((option): option is string => typeof option === "string");
}
