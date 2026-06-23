import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compareSessionsForDisplay, type SessionSummary } from "../../shared/types";

type PinState = Record<string, boolean>;

export class SessionPinStore {
	private readonly filePath = join(app.getPath("userData"), "session-pins.json");
	private state: PinState = {};
	private loaded = false;

	async load() {
		if (this.loaded) return;
		try {
			const raw = await readFile(this.filePath, "utf8");
			const parsed = JSON.parse(raw) as unknown;
			this.state = this.parseState(parsed);
		} catch {
			this.state = {};
		}
		this.loaded = true;
	}

	decorate(projectId: string, sessions: SessionSummary[]) {
		return sessions
			.map((session) => ({
				...session,
				pinned: this.isPinned(projectId, session.filePath),
			}))
			.sort(compareSessionsForDisplay);
	}

	async toggle(projectId: string, filePath: string) {
		await this.load();
		const key = this.key(projectId, filePath);
		const nextPinned = !this.state[key];
		if (nextPinned) {
			this.state[key] = true;
		} else {
			delete this.state[key];
		}
		await this.save();
		return nextPinned;
	}

	async removeProject(projectId: string) {
		await this.load();
		let changed = false;
		for (const key of Object.keys(this.state)) {
			if (!key.startsWith(`${projectId}::`)) continue;
			delete this.state[key];
			changed = true;
		}
		if (changed) await this.save();
	}

	private parseState(value: unknown): PinState {
		if (!value || typeof value !== "object" || Array.isArray(value)) return {};
		return Object.fromEntries(
			Object.entries(value).filter(([, pinned]) => pinned === true),
		) as PinState;
	}

	private isPinned(projectId: string, filePath: string) {
		return Boolean(this.state[this.key(projectId, filePath)]);
	}

	private key(projectId: string, filePath: string) {
		return `${projectId}::${filePath}`;
	}

	private async save() {
		await mkdir(app.getPath("userData"), { recursive: true });
		await writeFile(this.filePath, JSON.stringify(this.state, null, 2), "utf8");
	}
}
