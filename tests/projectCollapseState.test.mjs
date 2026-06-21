import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadModule() {
	const source = readFileSync(
		"src/renderer/src/projectCollapseState.ts",
		"utf8",
	);
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	});
	const sandbox = { exports: {} };
	vm.runInNewContext(outputText, sandbox, {
		filename: "projectCollapseState.ts",
	});
	return sandbox.exports;
}

const { syncCollapsedProjects } = loadModule();

function sortedIds(set) {
	return [...set].sort();
}

test("collapses all new projects on first load", () => {
	const result = syncCollapsedProjects(
		new Set(["project-a", "project-b"]),
		new Set(),
		new Set(),
	);

	assert.deepEqual(sortedIds(result.collapsedProjects), ["project-a", "project-b"]);
	assert.deepEqual(sortedIds(result.seenProjectIds), ["project-a", "project-b"]);
});

test("preserves user-expanded projects after project list reorder", () => {
	const result = syncCollapsedProjects(
		new Set(["project-a", "project-b"]),
		new Set(["project-a"]), // project-b is expanded (absent from collapsed)
		new Set(["project-a", "project-b"]),
	);

	assert.deepEqual(sortedIds(result.collapsedProjects), ["project-a"]);
	assert.deepEqual(sortedIds(result.seenProjectIds), ["project-a", "project-b"]);
});

test("collapses newly added project while keeping existing state", () => {
	const result = syncCollapsedProjects(
		new Set(["project-a", "project-c"]),
		new Set(["project-a"]),
		new Set(["project-a"]),
	);

	assert.deepEqual(sortedIds(result.collapsedProjects), ["project-a", "project-c"]);
	assert.deepEqual(sortedIds(result.seenProjectIds), ["project-a", "project-c"]);
});

test("removes deleted collapsed project from both collapsed and seen sets", () => {
	const result = syncCollapsedProjects(
		new Set(["project-a"]),
		new Set(["project-a", "project-b"]),
		new Set(["project-a", "project-b"]),
	);

	// project-b removed, project-a stays collapsed
	assert.deepEqual(sortedIds(result.collapsedProjects), ["project-a"]);
	assert.deepEqual(sortedIds(result.seenProjectIds), ["project-a"]);
});

test("removes deleted expanded project from both sets", () => {
	const result = syncCollapsedProjects(
		new Set(["project-a"]),
		new Set(), // project-b was expanded
		new Set(["project-a", "project-b"]),
	);

	assert.deepEqual(sortedIds(result.collapsedProjects), []);
	assert.deepEqual(sortedIds(result.seenProjectIds), ["project-a"]);
});

test("returns same references when no changes", () => {
	const collapsed = new Set(["project-a"]);
	const seen = new Set(["project-a"]);

	const result = syncCollapsedProjects(
		new Set(["project-a"]),
		collapsed,
		seen,
	);

	assert.equal(result.collapsedProjects, collapsed);
	assert.equal(result.seenProjectIds, seen);
});
