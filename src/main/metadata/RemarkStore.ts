import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type RemarkRecord = {
	remark?: string;
};

type RemarkState = {
	skills: Record<string, RemarkRecord>;
	extensions: Record<string, RemarkRecord>;
};

const defaultState: RemarkState = {
	skills: {},
	extensions: {},
};

/**
 * 备注是纯本地元数据，不写回 Skill 文件或扩展包源码。
 * 这样用户可以补中文说明，但不会污染上游内容，也不会影响升级/同步。
 */
export class RemarkStore {
	private readonly filePath = join(app.getPath("userData"), "remarks.json");
	private state: RemarkState = { ...defaultState, skills: {}, extensions: {} };
	private loaded = false;

	async load() {
		if (this.loaded) return;
		try {
			const raw = await readFile(this.filePath, "utf8");
			const parsed = JSON.parse(raw) as Partial<RemarkState> | undefined;
			this.state = {
				skills: parsed?.skills && typeof parsed.skills === "object" ? { ...parsed.skills } : {},
				extensions: parsed?.extensions && typeof parsed.extensions === "object" ? { ...parsed.extensions } : {},
			};
		} catch {
			this.state = { skills: {}, extensions: {} };
		}
		this.loaded = true;
	}

	getSkillRemark(id: string) {
		return this.state.skills[id]?.remark ?? "";
	}

	getExtensionRemark(id: string) {
		return this.state.extensions[id]?.remark ?? "";
	}

	async setSkillRemark(id: string, remark: string) {
		await this.setRemark("skills", id, remark);
	}

	async setExtensionRemark(id: string, remark: string) {
		await this.setRemark("extensions", id, remark);
	}

	applySkills<T extends { id: string } & Record<string, unknown>>(items: T[]) {
		return items.map((item) => ({
			...item,
			remark: this.getSkillRemark(item.id),
		}));
	}

	applyExtensions<T extends { id: string } & Record<string, unknown>>(items: T[]) {
		return items.map((item) => ({
			...item,
			remark: this.getExtensionRemark(item.id),
		}));
	}

	private async setRemark(scope: keyof RemarkState, id: string, remark: string) {
		await this.load();
		const trimmed = remark.trim();
		const current = this.state[scope][id]?.remark ?? "";
		if (current === trimmed) return;
		if (trimmed) {
			this.state[scope][id] = { remark: trimmed };
		} else {
			delete this.state[scope][id];
		}
		await this.save();
	}

	private async save() {
		await mkdir(app.getPath("userData"), { recursive: true });
		await writeFile(this.filePath, JSON.stringify(this.state, null, 2), "utf8");
	}
}
