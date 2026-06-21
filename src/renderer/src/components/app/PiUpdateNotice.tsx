import type { PiUpdateNoticeInfo } from "../../../../shared/types";
import { t } from "../../i18n";
import { CloseIconButton } from "../ui/IconButton";

export function PiUpdateNotice(props: {
	notice: PiUpdateNoticeInfo;
	onCopyCommand: (command: string) => void;
	onOpenChangelog: () => void;
	onDismiss: () => void;
}) {
	const hasCoreUpdate = props.notice.hasCoreUpdate && props.notice.latestVersion;
	const hasPackageUpdates = props.notice.packageUpdates.length > 0;

	return (
		<aside className="pi-update-notice" aria-label={t("piUpdate.ariaLabel")}>
			{hasCoreUpdate && (
				<section className="pi-update-card">
					<div className="pi-update-card-header">
						<strong>{t("piUpdate.coreTitle")}</strong>
						<CloseIconButton label={t("common.close")} onClick={props.onDismiss} />
					</div>
					<p>
						{t("piUpdate.coreDescription", {
							current: props.notice.currentVersion ?? "-",
							latest: props.notice.latestVersion ?? "-",
						})}
					</p>
					<div className="pi-update-actions">
						<button onClick={() => props.onCopyCommand("pi update")}>
							{t("piUpdate.copyCoreCommand")}
						</button>
						<button onClick={props.onOpenChangelog}>{t("piUpdate.openChangelog")}</button>
					</div>
				</section>
			)}
			{hasPackageUpdates && (
				<section className="pi-update-card">
					<div className="pi-update-card-header">
						<strong>{t("piUpdate.packagesTitle")}</strong>
						{!hasCoreUpdate && (
							<CloseIconButton label={t("common.close")} onClick={props.onDismiss} />
						)}
					</div>
					<p>{t("piUpdate.packagesDescription")}</p>
					<ul className="pi-update-package-list">
						{props.notice.packageUpdates.map((update) => (
							<li key={`${update.scope}:${update.source}`}>
								<span>{update.displayName}</span>
								{update.currentVersion && update.latestVersion && (
									<small>
										{t("piUpdate.packageVersion", {
											current: update.currentVersion,
											latest: update.latestVersion,
										})}
									</small>
								)}
							</li>
						))}
					</ul>
					<div className="pi-update-actions">
						<button onClick={() => props.onCopyCommand("pi update --extensions")}>
							{t("piUpdate.copyPackagesCommand")}
						</button>
					</div>
				</section>
			)}
		</aside>
	);
}
