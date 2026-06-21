import type { Dispatch, SetStateAction } from "react";
import { t } from "../../i18n";
import {
	getSlashStageSummary,
	type SlashCommandStage,
} from "../../slashCommandStage";

type SlashCommandStagePanelProps = {
	stage: SlashCommandStage;
	onStageChange: Dispatch<SetStateAction<SlashCommandStage | null>>;
	onExecute: (stage?: SlashCommandStage) => void;
};

export function SlashCommandStagePanel(props: SlashCommandStagePanelProps) {
	const { stage } = props;

	return (
		<div className="interactive-option-bar slash-command-stage">
			<div className="interactive-option-bar__header">
				<strong>{`/${stage.command}`}</strong>
				<span>{t("slashStage.keyboardHint")}</span>
			</div>
			<div className="slash-command-stage__body">
				{stage.command === "compact" ? (
					<>
						<label className="slash-command-stage__label">
							{t("slashStage.compactLabel")}
						</label>
						<textarea
							className="slash-command-stage__input"
							value={stage.argument}
							onChange={(event) =>
								props.onStageChange((current) =>
									current ? { ...current, argument: event.target.value } : current,
								)
							}
							placeholder={t("slashStage.compactPlaceholder")}
						/>
					</>
				) : stage.options && stage.options.length > 0 ? (
					<div className="slash-command-stage__list">
						{stage.options.map((option, index) => (
							<button
								key={option.id}
								type="button"
								className={
									index === (stage.selectedIndex ?? 0)
										? "slash-command-stage__option active"
										: "slash-command-stage__option"
								}
								onClick={() =>
									props.onStageChange((current) =>
										current ? { ...current, selectedIndex: index } : current,
									)
								}
								onDoubleClick={() => props.onExecute({ ...stage, selectedIndex: index })}
							>
								<strong>{option.label}</strong>
								{option.description && <span>{option.description}</span>}
							</button>
						))}
					</div>
				) : (
					<div className="slash-command-stage__summary">
						{getSlashStageSummary(stage.command)}
					</div>
				)}
				<div className="slash-command-stage__actions">
					<button type="button" onClick={() => props.onStageChange(null)}>
						{t("common.cancel")}
					</button>
					<button
						type="button"
						className="primary"
						onClick={() => props.onExecute()}
					>
						{t("slashStage.execute")}
					</button>
				</div>
			</div>
		</div>
	);
}
