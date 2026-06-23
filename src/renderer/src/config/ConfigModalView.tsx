import { AuthTab } from "./AuthTab";
import { ExtensionsTab } from "./ExtensionsTab";
import { ModelsTab } from "./ModelsTab";
import { RawTab } from "./RawTab";
import { SettingsTab } from "./SettingsTab";
import { SkillsTab } from "./SkillsTab";
import { t } from "../i18n";
import { CloseIconButton } from "../components/ui/IconButton";

type ConfigModalViewProps = Record<string, any>;

export function ConfigModalView(props: ConfigModalViewProps) {
  const {
    addingAuth,
    addingProvider,
    api,
    authData,
    configDiagnostic,
    ConfigDiagnosticCard,
    configNavItems,
    confirmDeleteSkill,
    confirmUninstallExtension,
    creatingSkill,
    deleteConfirm,
    deleteSkillConfirm,
    error,
    expandedAuth,
    expandedProvider,
    extensionsData,
    fetchedModels,
    fetchingProvider,
    fetchModelsErrorByProvider,
    handleAddAuth,
    handleAddModel,
    handleAddProvider,
    handleCancelRename,
    handleConfirmRename,
    handleCreateSkill,
    handleDeleteAuth,
    handleDeleteAuths,
    handleDeleteModel,
    handleDeleteProvider,
    handleDeleteProviders,
    handleDuplicateAuth,
    handleDuplicateProvider,
    handleExport,
    handleFetchModels,
    handleImport,
    handleRawFileChange,
    handleSaveAuth,
    handleSaveModels,
    handleSaveRaw,
    handleSaveSettings,
    handleStartRename,
    handleTestProvider,
    handleToggleExtension,
    handleToggleSkill,
    handleUpdateAuth,
    handleUpdateModel,
    loading,
    modelsData,
    newAuthName,
    newProviderName,
    newSkillDescription,
    newSkillLocationId,
    newSkillName,
    onClose,
    rawContent,
    rawFileName,
    refreshExtensions,
    refreshSkills,
    renameValue,
    renamingProvider,
    saving,
    section,
    setAddingAuth,
    setAddingProvider,
    setDeleteConfirm,
    setDeleteSkillConfirm,
    setExpandedAuth,
    setExpandedProvider,
    setModelsData,
    setNewAuthName,
    setNewProviderName,
    setNewSkillDescription,
    setNewSkillLocationId,
    setNewSkillName,
    setRawContent,
    setRenameValue,
    setSection,
    setSettingsData,
    setTab,
    setTestModelIdByProvider,
    setTestResult,
    settingsData,
    setUninstallExtensionConfirm,
    skillsData,
    tab,
    testingProvider,
    testModelIdByProvider,
    testResult,
    toast,
    togglingExtensionSource,
    uninstallExtensionConfirm,
    uninstallingExtensionSource,
  } = props;

return (
		<div className="modal-backdrop">
			<div className="config-modal">
				<div className="modal-header">
					<strong>{t("config.title")}</strong>
					<div className="modal-header-actions">
						{section === "config" && (
							<>
								<button className="config-btn primary" onClick={handleExport}>
									{t("common.export")}
								</button>
								<button className="config-btn blue" onClick={handleImport}>
									{t("common.import")}
								</button>
							</>
						)}
						<CloseIconButton label={t("common.close")} onClick={onClose} />
					</div>
				</div>

				<div className="config-layout">
					<aside className="config-sidebar" aria-label={t("config.title")}>
						<div className="config-sidebar-group">
							<span>{t("config.group.config")}</span>
							{configNavItems.map((item: any) => (
								<button
									key={item.id}
									className={
										section === "config" && tab === item.id ? "active" : ""
									}
									onClick={() => {
										setSection("config");
										setTab(item.id);
									}}
								>
									{item.label}
								</button>
							))}
						</div>
						<div className="config-sidebar-group">
							<span>{t("config.group.agent")}</span>
							<button
								className={section === "extensions" ? "active" : ""}
								onClick={() => setSection("extensions")}
							>
								{t("config.nav.extensions")}
							</button>
							<button
								className={section === "skills" ? "active" : ""}
								onClick={() => setSection("skills")}
							>
								{t("config.nav.skills")}
							</button>
						</div>
					</aside>

					<main className="config-main">
						<div className="config-content">
					{loading && <div className="config-loading">{t("common.loading")}</div>}
					{error && <div className="config-error">{error}</div>}
					{section === "config" && configDiagnostic && (
						<ConfigDiagnosticCard
							diagnostic={configDiagnostic}
							onOpenDocs={() => api.app.openExternal(configDiagnostic.docsUrl)}
							onOpenRaw={() => setTab("raw")}
						/>
					)}

					{section === "config" && !loading && tab === "models" && (
						<ModelsTab
							data={modelsData}
							expandedProvider={expandedProvider}
							addingProvider={addingProvider}
							newProviderName={newProviderName}
							renamingProvider={renamingProvider}
							renameValue={renameValue}
							fetchingProvider={fetchingProvider}
							fetchedModels={fetchedModels}
							fetchModelsErrorByProvider={fetchModelsErrorByProvider}
							testingProvider={testingProvider}
							testResult={testResult}
							testModelIdByProvider={testModelIdByProvider}
							saving={saving}
							onToggleProvider={(name: any) =>
								setExpandedProvider(expandedProvider === name ? null : name)
							}
							onStartAddProvider={() => {
								setAddingProvider(true);
								setNewProviderName("");
							}}
							onCancelAddProvider={() => setAddingProvider(false)}
							onChangeNewProviderName={setNewProviderName}
							onConfirmAddProvider={handleAddProvider}
							onStartRename={handleStartRename}
							onChangeRenameValue={setRenameValue}
							onConfirmRename={handleConfirmRename}
							onCancelRename={handleCancelRename}
							onDeleteProvider={handleDeleteProvider}
							onDuplicateProvider={handleDuplicateProvider}
						onDeleteProviders={handleDeleteProviders}
							onAddModel={handleAddModel}
							onUpdateModel={handleUpdateModel}
							onDeleteModel={handleDeleteModel}
							onFetchModels={handleFetchModels}
							onTestProvider={handleTestProvider}
							onChangeTestModelId={(providerName: any, modelId: any) =>
								setTestModelIdByProvider((current: any) => ({
									...current,
									[providerName]: modelId,
								}))
							}
							onClearTestResult={() => setTestResult(null)}
							onSave={handleSaveModels}
							onChangeProvider={(name: any, field: any, value: any) => {
								const provider = modelsData.providers[name];
								if (!provider) return;
								setModelsData({
									...modelsData,
									providers: {
										...modelsData.providers,
										[name]: { ...provider, [field]: value },
									},
								});
							}}
						/>
					)}

					{section === "config" && !loading && tab === "auth" && (
						<AuthTab
							data={authData}
							expandedAuth={expandedAuth}
							addingAuth={addingAuth}
							newAuthName={newAuthName}
							saving={saving}
							onToggleAuth={(name: any) =>
								setExpandedAuth(expandedAuth === name ? null : name)
							}
							onStartAddAuth={() => {
								setAddingAuth(true);
								setNewAuthName("");
							}}
							onCancelAddAuth={() => setAddingAuth(false)}
							onChangeNewAuthName={setNewAuthName}
							onConfirmAddAuth={handleAddAuth}
							onDuplicateAuth={handleDuplicateAuth}
						onDeleteAuths={handleDeleteAuths}
						onDeleteAuth={handleDeleteAuth}
							onUpdate={handleUpdateAuth}
							onSave={handleSaveAuth}
						/>
					)}

					{section === "config" && !loading && tab === "settings" && (
						<SettingsTab
							data={settingsData}
							saving={saving}
							onChange={setSettingsData}
							onSave={handleSaveSettings}
						/>
					)}


					{section === "skills" && !loading && (
						<SkillsTab
							data={skillsData}
							loading={loading}
							creating={creatingSkill}
							newName={newSkillName}
							newDescription={newSkillDescription}
							newLocationId={newSkillLocationId}
							onRefresh={refreshSkills}
							onOpenRoot={() => api.skills.openFolder()}
							onChangeNewName={setNewSkillName}
							onChangeNewDescription={setNewSkillDescription}
							onChangeNewLocation={setNewSkillLocationId}
							onCreate={handleCreateSkill}
							onToggle={(skill: any, enabled: any) => handleToggleSkill(skill.path, enabled)}
							onDelete={setDeleteSkillConfirm}
							onOpenFolder={(skill: any) => api.skills.openFolder(skill.path)}
							onEditRemark={async (skill: any, remark: any) => {
								await api.skills.editRemark(skill.id, remark);
								await refreshSkills();
							}}
						/>
					)}

					{section === "extensions" && !loading && (
						<ExtensionsTab
							data={extensionsData}
							loading={loading}
							projectPath={props.projectPath}
							togglingSource={togglingExtensionSource}
							uninstallingSource={uninstallingExtensionSource}
							onRefresh={refreshExtensions}
							onToggle={handleToggleExtension}
							onUninstall={setUninstallExtensionConfirm}
							onEditRemark={async (extension: any, remark: any) => {
								await api.extensions.editRemark(extension.id, remark);
								await refreshExtensions();
							}}
						/>
					)}

					{section === "config" && !loading && tab === "raw" && (
						<RawTab
							fileName={rawFileName}
							content={rawContent}
							saving={saving}
							onChangeFileName={handleRawFileChange}
							onChangeContent={setRawContent}
							onSave={handleSaveRaw}
						/>
					)}
						</div>
					</main>
				</div>

				{deleteSkillConfirm && (
					<div className="session-delete-confirm-backdrop" onClick={() => setDeleteSkillConfirm(null)}>
						<div className="session-delete-confirm skill-delete-confirm" onClick={(event: any) => event.stopPropagation()}>
							<strong>{t("config.deleteSkillConfirmTitle")}</strong>
							<p>
								{t("config.deleteSkillConfirmBody", {
									name: deleteSkillConfirm.name,
								})}
							</p>
							<small>{deleteSkillConfirm.path}</small>
							<div className="session-delete-confirm-actions">
								<button onClick={() => setDeleteSkillConfirm(null)}>{t("common.cancel")}</button>
								<button className="danger" onClick={() => void confirmDeleteSkill()}>
									{t("common.delete")}
								</button>
							</div>
						</div>
					</div>
				)}

				{uninstallExtensionConfirm && (
					<div className="session-delete-confirm-backdrop" onClick={() => setUninstallExtensionConfirm(null)}>
						<div className="session-delete-confirm skill-delete-confirm" onClick={(event: any) => event.stopPropagation()}>
							<strong>{t("config.uninstallExtensionTitle")}</strong>
							<p>
								{t("config.uninstallExtensionBody", {
									source: uninstallExtensionConfirm.source,
								})}
							</p>
							{uninstallExtensionConfirm.path && <small>{uninstallExtensionConfirm.path}</small>}
							<div className="session-delete-confirm-actions">
								<button onClick={() => setUninstallExtensionConfirm(null)}>{t("common.cancel")}</button>
								<button className="danger" onClick={confirmUninstallExtension}>{t("config.uninstall")}</button>
							</div>
						</div>
					</div>
				)}

				{toast && <div className="config-toast">{toast}</div>}

				{deleteConfirm && (
					<div className="config-modal-overlay" onClick={() => setDeleteConfirm(null)}>
						<div className="config-modal-dialog" onClick={(e: any) => e.stopPropagation()}>
							<strong>{deleteConfirm.title}</strong>
							<p>{deleteConfirm.message}</p>
							<div className="config-modal-actions">
								<button className="config-btn danger" onClick={deleteConfirm.onConfirm}>
									{t("common.delete")}
								</button>
								<button className="config-btn" onClick={() => setDeleteConfirm(null)}>
									{t("common.cancel")}
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
