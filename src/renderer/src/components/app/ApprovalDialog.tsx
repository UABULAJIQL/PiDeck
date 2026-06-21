import {
	useEffect,
	useRef,
	type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { AgentServerRequest } from "../../../../shared/types";

export function ApprovalDialog(props: {
	request: AgentServerRequest;
	title: string;
	message: string;
	options: Array<{
		key: string;
		label: string;
		response: Record<string, unknown>;
		danger?: boolean;
	}>;
	busy: boolean;
	onSelect: (response: Record<string, unknown>) => void;
}) {
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

	useEffect(() => {
		optionRefs.current[0]?.focus();
	}, [props.request.requestId]);

	function focusOption(nextIndex: number) {
		if (props.options.length === 0) return;
		const normalizedIndex = (nextIndex + props.options.length) % props.options.length;
		optionRefs.current[normalizedIndex]?.focus();
	}

	function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
		const activeIndex = optionRefs.current.findIndex(
			(button) => button === document.activeElement,
		);
		if (event.key === "ArrowDown" || event.key === "ArrowRight") {
			event.preventDefault();
			focusOption(activeIndex >= 0 ? activeIndex + 1 : 0);
		} else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
			event.preventDefault();
			focusOption(activeIndex >= 0 ? activeIndex - 1 : props.options.length - 1);
		} else if (event.key === "Home") {
			event.preventDefault();
			focusOption(0);
		} else if (event.key === "End") {
			event.preventDefault();
			focusOption(props.options.length - 1);
		}
	}

	return (
		<div className="session-delete-confirm-backdrop">
			<div
				className="session-delete-confirm approval-dialog"
				onKeyDown={handleKeyDown}
				role="dialog"
				aria-modal="true"
				aria-labelledby="approval-dialog-title"
			>
				<strong id="approval-dialog-title">{props.title}</strong>
				<p>{props.message}</p>
				{props.request.type !== "bash_input_request" && (
					<small className="approval-dialog-meta">{props.request.method}</small>
				)}
				<div className="session-delete-confirm-actions approval-dialog-actions">
					{props.options.map((option, index) => (
						<button
							key={option.key}
							ref={(element) => {
								optionRefs.current[index] = element;
							}}
							className={option.danger ? "danger" : ""}
							onClick={() => props.onSelect(option.response)}
							disabled={props.busy}
						>
							{option.label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
