import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SessionSummary } from "../../shared/types";
import { sortSessionsForDisplay } from "../../shared/sessionDisplay";

type PinEntry = {
	pinnedAt: number;
};

type PinState = Record<string, PinEntry>;

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

	async decorate(projectId: string, sessions: SessionSummary[]) {
		await this.load();
		return sortSessionsForDisplay(
			sessions.map((session) => {
				const pinEntry = this.getPinEntry(projectId, session.filePath);
				return {
					...session,
					pinned: Boolean(pinEntry),
					pinnedAt: pinEntry?.pinnedAt,
				};
			}),
		);
	}

	async toggle(projectId: string, filePath: string) {
		await this.load();
		const key = this.key(projectId, filePath);
		const nextPinned = !this.state[key];
		if (nextPinned) {
			this.state[key] = { pinnedAt: Date.now() };
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
		const state: PinState = {};
		for (const [key, pinValue] of Object.entries(value)) {
			if (
				!pinValue ||
				typeof pinValue !== "object" ||
				Array.isArray(pinValue) ||
				typeof (pinValue as { pinnedAt?: unknown }).pinnedAt !== "number"
			) {
				continue;
			}
			state[key] = { pinnedAt: (pinValue as { pinnedAt: number }).pinnedAt };
		}
		return state;
	}

	private getPinEntry(projectId: string, filePath: string) {
		return this.state[this.key(projectId, filePath)];
	}

	private key(projectId: string, filePath: string) {
		return `${projectId}::${filePath}`;
	}

	private async save() {
		await mkdir(app.getPath("userData"), { recursive: true });
		await writeFile(this.filePath, JSON.stringify(this.state, null, 2), "utf8");
	}
}
