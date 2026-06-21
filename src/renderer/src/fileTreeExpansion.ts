export function shouldResetExpandedDirsForProjectChange(
	previousProjectId: string | undefined,
	nextProjectId: string,
): boolean {
	return previousProjectId !== undefined && previousProjectId !== nextProjectId;
}
