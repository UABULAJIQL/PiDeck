import { useEffect, useState } from "react";
import { t } from "../i18n";

export function useConfigRemarkEditor(props: {
	remark?: string;
	onSave: (remark: string) => void | Promise<void>;
}) {
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [value, setValue] = useState(props.remark ?? "");

	useEffect(() => {
		if (!editing) setValue(props.remark ?? "");
	}, [editing, props.remark]);

	async function save() {
		setSaving(true);
		try {
			await props.onSave(value);
			setEditing(false);
		} finally {
			setSaving(false);
		}
	}

	return {
		content: editing ? (
			<label className="skill-remark-field">
				<span>{t("config.remark")}</span>
				<textarea
					value={value}
					disabled={saving}
					onChange={(event) => setValue(event.target.value)}
					placeholder={t("config.remarkPlaceholder")}
				/>
			</label>
		) : props.remark ? (
			<small className="skill-remark-text">{props.remark}</small>
		) : (
			<small className="skill-remark-text muted">{t("config.remarkMissing")}</small>
		),
		actions: editing ? (
			<>
				<button
					className="session-rename-button"
					disabled={saving}
					onClick={() => void save()}
				>
					{t("common.save")}
				</button>
				<button
					className="session-rename-button"
					disabled={saving}
					onClick={() => {
						setValue(props.remark ?? "");
						setEditing(false);
					}}
				>
					{t("common.cancel")}
				</button>
			</>
		) : (
			<button className="session-rename-button" onClick={() => setEditing(true)}>
				{t("common.edit")}
			</button>
		),
	};
}
