import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentServerRequest } from "../../../../shared/types";
import type { ApprovalOption } from "../../approvalRequest";

export function ApprovalDialog(props: {
	request: AgentServerRequest;
	title: string;
	message: string;
	options: ApprovalOption[];
	mode?: "actions" | "select";
	filterPlaceholder?: string;
	emptyLabel?: string;
	helperText?: string;
	cancelResponse?: Record<string, unknown>;
	busy: boolean;
	onSelect: (response: Record<string, unknown>) => void;
}) {
	const mode = props.mode ?? "actions";
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const selectOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const filterInputRef = useRef<HTMLInputElement | null>(null);
	const respondedRef = useRef(false);
	const [filter, setFilter] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const optionKeys = props.options.map((option) => option.key).join("\u0000");
	optionRefs.current.length = props.options.length;

	const filteredOptions = useMemo(() => {
		const normalizedFilter = filter.trim().toLowerCase();
		if (!normalizedFilter) return props.options;
		return props.options.filter((option) =>
			[option.label, option.description]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(normalizedFilter)),
		);
	}, [filter, props.options]);
	selectOptionRefs.current.length = filteredOptions.length;

	function getSafeOptionIndex() {
		const dangerIndex = props.options.findIndex((option) => option.danger);
		if (dangerIndex >= 0) return dangerIndex;
		const cancelIndex = props.options.findIndex((option) =>
			/(?:no|decline|cancel)/i.test(`${option.key} ${option.label}`),
		);
		return cancelIndex >= 0 ? cancelIndex : 0;
	}

	function focusOption(nextIndex: number) {
		if (props.options.length === 0) return;
		const normalizedIndex = (nextIndex + props.options.length) % props.options.length;
		optionRefs.current[normalizedIndex]?.focus();
	}

	function selectResponse(response: Record<string, unknown>) {
		if (props.busy || respondedRef.current) return;
		respondedRef.current = true;
		props.onSelect(response);
	}

	function selectActionOption(index: number) {
		if (index < 0 || index >= props.options.length) return;
		selectResponse(props.options[index].response);
	}

	function selectFilteredOption(index: number) {
		if (index < 0 || index >= filteredOptions.length) return;
		selectResponse(filteredOptions[index].response);
	}

	useEffect(() => {
		respondedRef.current = false;
		if (mode === "select") {
			setFilter("");
			setActiveIndex(0);
			const frame = window.requestAnimationFrame(() => filterInputRef.current?.focus());
			return () => window.cancelAnimationFrame(frame);
		}
		const frame = window.requestAnimationFrame(() => focusOption(getSafeOptionIndex()));
		return () => window.cancelAnimationFrame(frame);
	}, [props.request.requestId, optionKeys, mode]);

	useEffect(() => {
		setActiveIndex(0);
	}, [filter, optionKeys]);

	useEffect(() => {
		if (activeIndex >= filteredOptions.length) {
			setActiveIndex(Math.max(0, filteredOptions.length - 1));
			return;
		}
		selectOptionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, filteredOptions.length]);

	useEffect(() => {
		function handleDocumentKeyDown(event: KeyboardEvent) {
			if (event.isComposing) return;

			if (mode === "select") {
				let handled = true;
				const lastIndex = filteredOptions.length - 1;

				if (event.key === "ArrowDown") {
					setActiveIndex((current) => (lastIndex < 0 ? 0 : Math.min(current + 1, lastIndex)));
				} else if (event.key === "ArrowUp") {
					setActiveIndex((current) => Math.max(current - 1, 0));
				} else if (event.key === "Home") {
					setActiveIndex(0);
				} else if (event.key === "End") {
					setActiveIndex(Math.max(0, lastIndex));
				} else if (event.key === "Enter") {
					selectFilteredOption(activeIndex);
				} else if (event.key === "Escape") {
					selectResponse(props.cancelResponse ?? { cancelled: true });
				} else {
					handled = false;
				}

				if (!handled) return;
				// 终端面板会主动抢焦点；在 document capture 阶段拦截选择器快捷键，避免按键落到 xterm。
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			if (props.options.length === 0) return;

			const activeActionIndex = optionRefs.current.findIndex(
				(button) => button === document.activeElement,
			);
			const safeIndex = getSafeOptionIndex();
			let handled = true;

			if (event.key === "ArrowDown" || event.key === "ArrowRight") {
				focusOption(activeActionIndex >= 0 ? activeActionIndex + 1 : safeIndex);
			} else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
				focusOption(activeActionIndex >= 0 ? activeActionIndex - 1 : safeIndex);
			} else if (event.key === "Home") {
				focusOption(0);
			} else if (event.key === "End") {
				focusOption(props.options.length - 1);
			} else if (event.key === "Tab") {
				focusOption(
					activeActionIndex >= 0
						? activeActionIndex + (event.shiftKey ? -1 : 1)
						: safeIndex,
				);
			} else if (event.key === "Enter" || event.key === " ") {
				if (activeActionIndex >= 0) {
					selectActionOption(activeActionIndex);
				} else {
					focusOption(safeIndex);
				}
			} else if (event.key === "Escape") {
				selectActionOption(safeIndex);
			} else {
				handled = false;
			}

			if (!handled) return;
			// 终端面板会主动抢焦点；在 document capture 阶段拦截审批快捷键，避免按键落到 xterm。
			event.preventDefault();
			event.stopPropagation();
		}

		document.addEventListener("keydown", handleDocumentKeyDown, true);
		return () => document.removeEventListener("keydown", handleDocumentKeyDown, true);
	}, [
		activeIndex,
		filteredOptions,
		mode,
		props.busy,
		props.cancelResponse,
		props.onSelect,
		props.options,
	]);

	return (
		<div className="approval-dialog-backdrop">
			<div
				className={[
					"approval-dialog",
					mode === "select" ? "approval-select-dialog" : undefined,
				]
					.filter(Boolean)
					.join(" ")}
				role="dialog"
				aria-modal="true"
				aria-labelledby="approval-dialog-title"
			>
				<strong id="approval-dialog-title">{props.title}</strong>
				<p>{props.message}</p>
				{props.request.type !== "bash_input_request" && mode !== "select" && (
					<small className="approval-dialog-meta">{props.request.method}</small>
				)}
				{mode === "select" ? (
					<>
						<div className="approval-select-search">
							<input
								ref={filterInputRef}
								value={filter}
								onChange={(event) => setFilter(event.target.value)}
								placeholder={props.filterPlaceholder}
								aria-label={props.filterPlaceholder}
								aria-controls="approval-select-list"
								aria-activedescendant={
									filteredOptions[activeIndex]
										? `approval-select-option-${activeIndex}`
										: undefined
								}
								aria-expanded="true"
								role="combobox"
								disabled={props.busy}
							/>
						</div>
						<div
							id="approval-select-list"
							className="approval-select-list"
							role="listbox"
						>
							{filteredOptions.length > 0 ? (
								filteredOptions.map((option, index) => (
									<button
										id={`approval-select-option-${index}`}
										key={option.key}
										ref={(element) => {
											selectOptionRefs.current[index] = element;
										}}
										type="button"
										className={
											index === activeIndex
												? "approval-select-option active"
												: "approval-select-option"
										}
										role="option"
										aria-selected={index === activeIndex}
										onMouseEnter={() => setActiveIndex(index)}
										onClick={() => selectFilteredOption(index)}
										disabled={props.busy}
									>
										<span className="approval-select-option-label">{option.label}</span>
										{option.description && (
											<span className="approval-select-option-desc">{option.description}</span>
										)}
									</button>
								))
							) : (
								<div className="approval-select-empty">{props.emptyLabel}</div>
							)}
						</div>
						{props.helperText && (
							<small className="approval-dialog-help">{props.helperText}</small>
						)}
					</>
				) : (
					<div className="approval-dialog-actions">
						{props.options.map((option, index) => (
							<button
								key={option.key}
								ref={(element) => {
									optionRefs.current[index] = element;
								}}
								className={option.danger ? "danger" : ""}
								onClick={() => selectActionOption(index)}
								disabled={props.busy}
							>
								{option.label}
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
