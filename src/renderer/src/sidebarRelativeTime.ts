import { t } from "./i18n";

export const SIDEBAR_RELATIVE_TIME_REFRESH_MS = 60_000;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

export function formatSidebarRelativeTime(timestamp: number, now: number) {
	if (!Number.isFinite(timestamp)) return "";
	const elapsed = Math.max(0, now - timestamp);
	if (elapsed < MINUTE_MS) return t("app.sidebarTimeJustNow");
	if (elapsed < HOUR_MS) {
		return t("app.sidebarTimeMinutes", {
			count: Math.max(1, Math.floor(elapsed / MINUTE_MS)),
		});
	}
	if (elapsed < DAY_MS) {
		return t("app.sidebarTimeHours", {
			count: Math.max(1, Math.floor(elapsed / HOUR_MS)),
		});
	}
	if (elapsed < MONTH_MS) {
		return t("app.sidebarTimeDays", {
			count: Math.max(1, Math.floor(elapsed / DAY_MS)),
		});
	}
	if (elapsed < YEAR_MS) {
		return t("app.sidebarTimeMonths", {
			count: Math.max(1, Math.floor(elapsed / MONTH_MS)),
		});
	}
	return t("app.sidebarTimeYears", {
		count: Math.max(1, Math.floor(elapsed / YEAR_MS)),
	});
}
