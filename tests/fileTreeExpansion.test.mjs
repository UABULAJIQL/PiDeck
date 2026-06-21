import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadFileTreeExpansionModule() {
	const source = readFileSync("src/renderer/src/fileTreeExpansion.ts", "utf8");
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	});
	const sandbox = { exports: {} };
	vm.runInNewContext(outputText, sandbox, {
		filename: "fileTreeExpansion.ts",
	});
	return sandbox.exports;
}

test("keeps folder expansion during initial file tree ownership assignment", () => {
	const { shouldResetExpandedDirsForProjectChange } = loadFileTreeExpansionModule();

	assert.equal(shouldResetExpandedDirsForProjectChange(undefined, "project-a"), false);
});

test("resets folder expansion only when switching between loaded projects", () => {
	const { shouldResetExpandedDirsForProjectChange } = loadFileTreeExpansionModule();

	assert.equal(shouldResetExpandedDirsForProjectChange("project-a", "project-a"), false);
	assert.equal(shouldResetExpandedDirsForProjectChange("project-a", "project-b"), true);
});
