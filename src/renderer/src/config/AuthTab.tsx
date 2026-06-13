import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { t } from "../i18n";
import type { AuthFile } from "./configTypes";
import { SecretInput } from "./ConfigShared";

// ── Auth Tab ────────────────────────────────────────────

export function AuthTab(props: {
	data: AuthFile;
	expandedAuth: string | null;
	addingAuth: boolean;
	newAuthName: string;
	saving: boolean;
	onToggleAuth: (name: string) => void;
	onStartAddAuth: () => void;
	onCancelAddAuth: () => void;
	onChangeNewAuthName: (name: string) => void;
	onConfirmAddAuth: () => void;
	onDeleteAuth: (provider: string) => void;
	onUpdate: (provider: string, field: string, value: string) => void;
	onSave: () => void;
}) {
	const { data, expandedAuth, saving } = props;
	const providers = Object.keys(data);

	return (
		<div className="config-auth-tab">
			<div className="config-toolbar">
				<span className="config-count">
					{t("config.count.providers", { count: providers.length })}
				</span>
				<div className="config-toolbar-actions">
					<button
						className="config-btn"
						onClick={props.onStartAddAuth}
						disabled={saving}
					>
						{t("config.addAuth")}
					</button>
					<button
						className="config-btn primary"
						onClick={props.onSave}
						disabled={saving}
					>
						{saving ? t("common.saving") : t("common.save")}
					</button>
				</div>
			</div>

			{props.addingAuth && (
				<div className="config-add-provider-row">
					<input
						value={props.newAuthName}
						onChange={(e) => props.onChangeNewAuthName(e.target.value)}
						placeholder={t("config.providerNamePlaceholder")}
						onKeyDown={(e) => e.key === "Enter" && props.onConfirmAddAuth()}
						autoFocus
					/>
					<button
						className="config-btn primary"
						onClick={props.onConfirmAddAuth}
						disabled={!props.newAuthName.trim()}
					>
						{t("common.confirm")}
					</button>
					<button className="config-btn" onClick={props.onCancelAddAuth}>
						{t("common.cancel")}
					</button>
				</div>
			)}

			<div className="config-auth-list">
				{providers.map((name) => {
					const auth = data[name];
					const isExpanded = expandedAuth === name;
					return (
						<div
							key={name}
							className={`config-auth-card ${isExpanded ? "editing" : ""}`}
						>
							<div
								className="config-auth-card-header"
								onClick={() => props.onToggleAuth(name)}
							>
								<span className="config-auth-provider">{name}</span>
								<span className="config-auth-key-preview">
									{auth.key
										? `${auth.key.slice(0, 10)}••••••${auth.key.slice(-4)}`
										: t("config.authKeyPreviewEmpty")}
								</span>
								<div className="config-provider-actions">
									<button
										className="config-icon-btn danger"
										onClick={(e) => {
											e.stopPropagation();
											props.onDeleteAuth(name);
										}}
										title={t("common.delete")}
									>
										<Trash2 size={14} />
									</button>
									<span className="config-chevron">
										{isExpanded ? (
											<ChevronDown size={14} />
										) : (
											<ChevronRight size={14} />
										)}
									</span>
								</div>
							</div>
							{isExpanded && (
								<div className="config-provider-form">
									<div className="config-form-row">
										<label>{t("config.field.type")}</label>
										<input
											value={auth.type ?? "api_key"}
											onChange={(e) =>
												props.onUpdate(name, "type", e.target.value)
											}
										/>
									</div>
									<div className="config-form-row">
										<label>{t("config.field.apiKey")}</label>
										<SecretInput
											value={auth.key ?? ""}
											onChange={(v) => props.onUpdate(name, "key", v)}
										/>
									</div>
								</div>
							)}
						</div>
					);
				})}
				{providers.length === 0 && (
					<div className="config-empty">{t("config.authEmpty")}</div>
				)}
			</div>
		</div>
	);
}


