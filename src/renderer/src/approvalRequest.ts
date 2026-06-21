import type { AgentServerRequest } from "../../shared/types";
import { t } from "./i18n";

export type ApprovalOption = {
  key: string;
  label: string;
  response: Record<string, unknown>;
  danger?: boolean;
};

export type ApprovalViewModel = {
  title: string;
  message: string;
  options: ApprovalOption[];
};

/**
 * 把 pi / 扩展协议里的交互请求统一转换成 UI 可渲染结构。
 * 协议字段属于 agent 业务边界，App 和通用弹窗只消费这个 view-model，避免 UI 组件内散落协议判断。
 */
export function describeApprovalRequest(request: AgentServerRequest): ApprovalViewModel {
  if (request.type === "bash_input_request") {
    const params = (request.params ?? {}) as Record<string, unknown>;
    const isYesNoSelect = params.inputMode === "yes_no_select";
    return {
      title: request.title ?? t("approval.cliConfirmTitle"),
      message: describeBashInputMessage(request),
      options: [
        {
          key: "bash-confirm-no",
          label: t("approval.cliInputNo"),
          // pi 的 TUI 审批菜单是光标选择而不是 y/n 提示；No 需要下移再回车。
          response: { input: isYesNoSelect ? "\x1b[B\r" : "n\n" },
          danger: true,
        },
        {
          key: "bash-confirm-yes",
          label: t("approval.cliInputYes"),
          response: { input: isYesNoSelect ? "\r" : "y\n" },
        },
      ],
    };
  }

  if (request.type === "extension_ui_request") {
    if (request.method === "confirm") {
      return {
        title: request.title ?? t("approval.title"),
        message: request.message ?? t("approval.genericMessage"),
        options: [
          {
            key: "confirm-yes",
            label: t("common.yes"),
            response: { confirmed: true },
          },
          {
            key: "confirm-no",
            label: t("common.no"),
            response: { confirmed: false },
            danger: true,
          },
        ],
      };
    }

    if (request.method === "select") {
      const options = request.options ?? [];
      return {
        title: request.title ?? t("approval.title"),
        message: request.message ?? t("approval.genericMessage"),
        options: options.map((option) => ({
          key: `select-${option}`,
          label: option,
          response: { value: option },
        })),
      };
    }
  }

  const params = (request.params ?? {}) as Record<string, unknown>;
  const command = typeof params.command === "string" ? params.command : undefined;
  const reason = typeof params.reason === "string" ? params.reason : undefined;
  const message = command
    ? t("approval.commandMessage", { command })
    : reason
      ? t("approval.reasonMessage", { reason })
      : request.message ?? t("approval.genericMessage");
  const availableDecisions = Array.isArray(params.availableDecisions)
    ? params.availableDecisions.filter((item): item is string => typeof item === "string")
    : [];
  const decisionList = availableDecisions.length > 0
    ? availableDecisions
    : ["accept", "decline", "cancel"];

  return {
    title: request.title ?? t("approval.title"),
    message,
    options: decisionList.map((decision) => ({
      key: decision,
      label: getDecisionLabel(decision),
      response: { decision },
      danger: decision === "decline",
    })),
  };
}

function describeBashInputMessage(request: AgentServerRequest) {
  const params = (request.params ?? {}) as Record<string, unknown>;
  if (params.fallbackReason === "maybe_waiting_confirmation") {
    return [
      t("approval.cliMaybeWaiting"),
      typeof params.command === "string"
        ? t("approval.cliCommand", { command: params.command })
        : "",
      typeof params.output === "string" && params.output
        ? t("approval.cliRecentOutput", { output: params.output })
        : "",
      t("approval.cliFallbackHint"),
    ].filter(Boolean).join("\n\n");
  }
  return request.message ?? t("approval.genericMessage");
}

function getDecisionLabel(decision: string) {
  switch (decision) {
    case "accept":
      return t("approval.accept");
    case "acceptForSession":
      return t("approval.acceptForSession");
    case "decline":
      return t("approval.decline");
    case "cancel":
      return t("approval.cancelRequest");
    default:
      return decision;
  }
}
