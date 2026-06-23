import type { SessionSummary } from "./types";

export function comparePinnedSessionsForDisplay(
  left: SessionSummary,
  right: SessionSummary,
) {
  return (
    (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0) ||
    right.updatedAt - left.updatedAt ||
    left.filePath.localeCompare(right.filePath)
  );
}

export function compareNormalSessionsForDisplay(
  left: SessionSummary,
  right: SessionSummary,
) {
  return right.updatedAt - left.updatedAt || left.filePath.localeCompare(right.filePath);
}

export function partitionSessionsForDisplay(sessions: SessionSummary[]) {
  const pinned = sessions
    .filter((session) => session.pinned)
    .sort(comparePinnedSessionsForDisplay);
  const normal = sessions
    .filter((session) => !session.pinned)
    .sort(compareNormalSessionsForDisplay);
  return { pinned, normal };
}

export function sortSessionsForDisplay(sessions: SessionSummary[]) {
  const { pinned, normal } = partitionSessionsForDisplay(sessions);
  return [...pinned, ...normal];
}
