import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadBashInputRequestTrackerModule(timerMode = "normal") {
	const source = readFileSync("src/main/pi/BashInputRequestTracker.ts", "utf8");
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	});
	const sandbox = {
		exports: {},
		setTimeout: (callback) => {
			if (timerMode === "immediate") callback();
			return { timer: true };
		},
		clearTimeout: () => undefined,
	};
	vm.runInNewContext(outputText, sandbox, {
		filename: "BashInputRequestTracker.ts",
	});
	return sandbox.exports;
}

function createTracker(timerMode = "normal") {
	const { BashInputRequestTracker } = loadBashInputRequestTrackerModule(timerMode);
	const emitted = [];
	const cancelled = [];
	const tracker = new BashInputRequestTracker({
		emitRequest: (agentId, request) => emitted.push({ agentId, request }),
		cancelRequest: (agentId, requestId) => cancelled.push({ agentId, requestId }),
	});
	return { tracker, emitted, cancelled };
}

test("does not ask users to handle a Windows cmd prompt from an assistant-owned command", () => {
	const { tracker, emitted } = createTracker();
	const command = 'cmd.exe /d /c "where rtk && rtk --version"';
	tracker.rememberCommand("agent-1", {
		toolName: "bash",
		toolCallId: "tool-1",
		args: { command },
	});

	tracker.maybeEmitRequest("agent-1", {
		toolName: "bash",
		toolCallId: "tool-1",
		partialResult: [
			"Microsoft Windows [Version 10.0.26200.8655]",
			"(c) Microsoft Corporation. All rights reserved.",
			"",
			"C:\\Users\\cq\\Software\\PiDeck>",
		].join("\n"),
	});

	assert.equal(emitted.length, 0);
});

test("does not mark cmd /c output as interactive without a confirmation prompt", () => {
	const { tracker, emitted } = createTracker();
	tracker.rememberCommand("agent-1", {
		toolName: "bash",
		toolCallId: "tool-2",
		args: { command: 'cmd.exe /d /c "echo ok"' },
	});

	tracker.maybeEmitRequest("agent-1", {
		toolName: "bash",
		toolCallId: "tool-2",
		partialResult: "ok\n",
	});

	assert.equal(emitted.length, 0);
});

test("still emits a bash input request for real yes/no confirmation prompts", () => {
	const { tracker, emitted } = createTracker();
	tracker.rememberCommand("agent-1", {
		toolName: "bash",
		toolCallId: "tool-3",
		args: { command: "npm install" },
	});

	tracker.maybeEmitRequest("agent-1", {
		toolName: "bash",
		toolCallId: "tool-3",
		partialResult: "Do you want to continue? [y/N]",
	});

	assert.equal(emitted.length, 1);
	assert.equal(emitted[0].request.type, "bash_input_request");
	assert.equal(emitted[0].request.params, undefined);
});

test("still emits select-mode input for pi TUI allow prompts", () => {
	const { tracker, emitted } = createTracker();
	tracker.rememberCommand("agent-1", {
		toolName: "bash",
		toolCallId: "tool-4",
		args: { command: "pi install example" },
	});

	tracker.maybeEmitRequest("agent-1", {
		toolName: "bash",
		toolCallId: "tool-4",
		partialResult: "Allow?\n> Yes\n  No",
	});

	assert.equal(emitted.length, 1);
	assert.equal(emitted[0].request.params.inputMode, "yes_no_select");
	assert.equal(emitted[0].request.params.command, "pi install example");
});

test("package-manager fallback remains a confirmation fallback, not a shell input request", () => {
	const { tracker, emitted } = createTracker("immediate");
	tracker.rememberCommand("agent-1", {
		toolName: "bash",
		toolCallId: "tool-5",
		args: { command: "npm install" },
	});

	tracker.maybeEmitRequest("agent-1", {
		toolName: "bash",
		toolCallId: "tool-5",
		partialResult: "Installing npm: example\nStill running...",
	});

	assert.equal(emitted.length, 1);
	assert.equal(emitted[0].request.params.fallbackReason, "maybe_waiting_confirmation");
	assert.notEqual(emitted[0].request.params.inputMode, "shell_text");
});
