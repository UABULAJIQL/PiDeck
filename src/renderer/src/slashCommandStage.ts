import type { ForkMessage, SessionSummary } from "../../shared/types";
import { t, type TranslationKey } from "./i18n";

export const SLASH_STAGE_COMMANDS = [
	"compact",
	"copy",
	"export",
	"clone",
	"restart",
	"settings",
	"session",
	"tree",
] as const;

export type SlashStageCommand = (typeof SLASH_STAGE_COMMANDS)[number];

export type SlashStageListOption = {
	id: string;
	label: string;
	description?: string;
	value: string;
};

export type SlashCommandStage = {
	command: SlashStageCommand;
	promptSnapshot: string;
	argument: string;
	options?: SlashStageListOption[];
	selectedIndex?: number;
};

const SLASH_STAGE_COMMAND_SET = new Set<string>(SLASH_STAGE_COMMANDS);
const SLASH_STAGE_SUMMARY_KEYS: Record<SlashStageCommand, TranslationKey> = {
	clone: "slashStage.summary.clone",
	compact: "slashStage.summary.compact",
	copy: "slashStage.summary.copy",
	export: "slashStage.summary.export",
	restart: "slashStage.summary.restart",
	session: "slashStage.summary.session",
	settings: "slashStage.summary.settings",
	tree: "slashStage.summary.tree",
};

export function getSlashStageCommand(promptValue: string): SlashStageCommand | null {
	const match = promptValue.trim().match(/^\/([a-zA-Z][\w-]*)/);
	if (!match) return null;
	const name = match[1].toLowerCase();
	return SLASH_STAGE_COMMAND_SET.has(name) ? (name as SlashStageCommand) : null;
}

export function getSlashStageArgument(command: SlashStageCommand, promptValue: string) {
	return promptValue.trim().replace(new RegExp(`^/${command}\\s*`, "i"), "");
}

export function isSlashStageStillActive(
	stage: SlashCommandStage | null,
	promptValue: string,
) {
	if (!stage) return false;
	const normalized = promptValue.trim().toLowerCase();
	return (
		normalized === `/${stage.command}` ||
		normalized.startsWith(`/${stage.command} `)
	);
}

export function createSlashCommandStage(
	command: SlashStageCommand,
	promptValue: string,
	options?: SlashStageListOption[],
): SlashCommandStage {
	return {
		command,
		promptSnapshot: promptValue,
		argument: getSlashStageArgument(command, promptValue),
		options,
		selectedIndex: options ? 0 : undefined,
	};
}

export function createSessionStageOptions(sessions: SessionSummary[]) {
	return sessions.slice(0, 12).map((session) => ({
		id: session.id,
		label: session.name || t("common.untitled"),
		description: session.preview || session.filePath,
		value: session.filePath,
	}));
}

export function createForkStageOptions(messages: ForkMessage[]) {
	return messages.slice(0, 16).map((message, index) => ({
		id: message.entryId,
		label:
			message.text.split(/\r?\n/)[0]?.trim() ||
			t("slashStage.treeNodeFallback", { count: index + 1 }),
		description: message.text,
		value: message.entryId,
	}));
}

export function getSlashStageSummary(command: SlashStageCommand) {
	return t(SLASH_STAGE_SUMMARY_KEYS[command]);
}
