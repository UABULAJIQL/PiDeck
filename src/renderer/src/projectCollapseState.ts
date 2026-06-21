/**
 * 同步项目折叠状态：新项目默认折叠，已见过的项目保留用户的选择，已删除的项目清理。
 *
 * @param projectIds - 当前所有项目 ID 集合
 * @param collapsedProjects - 当前折叠状态（collapsedProjects）
 * @param seenProjectIds - 已见过（首次加载过）的项目 ID 集合
 * @returns 新的折叠状态和已见过集合
 */
export function syncCollapsedProjects(
	projectIds: Set<string>,
	collapsedProjects: Set<string>,
	seenProjectIds: Set<string>,
): { collapsedProjects: Set<string>; seenProjectIds: Set<string> } {
	const nextCollapsed = new Set(collapsedProjects);
	const nextSeen = new Set(seenProjectIds);
	let changed = false;

	// 清理已删除项目的状态
	for (const id of seenProjectIds) {
		if (!projectIds.has(id)) {
			nextCollapsed.delete(id);
			nextSeen.delete(id);
			changed = true;
		}
	}

	// 新项目默认折叠
	for (const id of projectIds) {
		if (!seenProjectIds.has(id)) {
			nextCollapsed.add(id);
			nextSeen.add(id);
			changed = true;
		}
	}

	return {
		collapsedProjects: changed ? nextCollapsed : collapsedProjects,
		seenProjectIds: changed ? nextSeen : seenProjectIds,
	};
}
