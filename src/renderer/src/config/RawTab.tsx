// ── Raw Tab ─────────────────────────────────────────────

export function RawTab(props: {
	fileName: string;
	content: string;
	saving: boolean;
	onChangeFileName: (name: string) => void;
	onChangeContent: (content: string) => void;
	onSave: () => void;
}) {
	return (
		<div className="config-raw-tab">
			<div className="config-toolbar">
				<select
					value={props.fileName}
					onChange={(e) => props.onChangeFileName(e.target.value)}
				>
					<option value="models.json">models.json</option>
					<option value="auth.json">auth.json</option>
					<option value="settings.json">settings.json</option>
				</select>
				<button
					className="config-btn primary"
					onClick={props.onSave}
					disabled={props.saving}
				>
					{props.saving ? "保存中…" : "保存"}
				</button>
			</div>
			<textarea
				className="config-raw-editor"
				value={props.content}
				onChange={(e) => props.onChangeContent(e.target.value)}
				spellCheck={false}
			/>
		</div>
	);
}
