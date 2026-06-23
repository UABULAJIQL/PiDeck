import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChatMessage, ComposerImage } from "../../../../shared/types";
import {
  AgentRun,
  ChatBubble,
  SessionFileSummary,
  ThinkingBubble,
  ThinkingGroup,
  ToolGroup,
  type RenderMessage,
  type SessionModifiedFile,
} from "./AppParts";

export type VirtualizedListHandle = {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollToKey: (key: string, behavior?: ScrollBehavior) => void;
  isNearBottom: () => boolean;
};

type VirtualRow = {
  key: string;
  node: React.ReactNode;
};

type Props = {
  items: RenderMessage[];
  activeThinking?: string;
  awaitingAssistant?: boolean;
  showThinking?: boolean;
  fileSummariesByMessage?: Record<string, SessionModifiedFile[]>;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  className?: string;
  onPreviewImage: (image: ComposerImage) => void;
  onOpenExternal: (url: string) => void;
  onOpenFile?: (path: string) => void;
  onDiffFile?: (path: string) => void;
  onUndoUserMessage?: (message: ChatMessage) => void;
  onResendUserMessage?: (message: ChatMessage) => void;
  onScrollStateChange?: (state: { atBottom: boolean }) => void;
};

const DEFAULT_ROW_HEIGHT = 180;
const OVERSCAN_PX = 600;

export const VirtualizedMessageList = forwardRef<VirtualizedListHandle, Props>(
  function VirtualizedMessageList(props, ref) {
    const rowRefs = useRef(new Map<string, HTMLDivElement>());
    const heightsRef = useRef(new Map<string, number>());
    const [viewportHeight, setViewportHeight] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const [version, setVersion] = useState(0);
    const [container, setContainer] = useState<HTMLElement | null>(null);
    const onScrollStateChangeRef = useRef(props.onScrollStateChange);

    useEffect(() => {
      onScrollStateChangeRef.current = props.onScrollStateChange;
    }, [props.onScrollStateChange]);

    useEffect(() => {
      setContainer(props.scrollContainerRef.current);
    }, [props.scrollContainerRef, props.items.length, props.awaitingAssistant]);

    const rows = useMemo<VirtualRow[]>(() => {
      const baseRows = props.items.map((item) => ({
        key: item.kind === "message" ? item.message.id : item.id,
        node:
          item.kind === "agent-run" ? (
            <AgentRun
              run={item}
              onPreviewImage={props.onPreviewImage}
              onOpenExternal={props.onOpenExternal}
              onOpenFile={props.onOpenFile}
              onDiffFile={props.onDiffFile}
              onUndoUserMessage={props.onUndoUserMessage}
              onResendUserMessage={props.onResendUserMessage}
              showThinking={props.showThinking}
              fileSummariesByMessage={props.fileSummariesByMessage}
            />
          ) : item.kind === "tool-group" ? (
            <ToolGroup group={item} />
          ) : item.kind === "thinking-group" ? (
            <ThinkingGroup group={item} showThinking={props.showThinking} />
          ) : (
            <Fragment>
              <ChatBubble
                message={item.message}
                onPreviewImage={props.onPreviewImage}
                onOpenExternal={props.onOpenExternal}
                onOpenFile={props.onOpenFile}
                onUndoUserMessage={props.onUndoUserMessage}
                onResendUserMessage={props.onResendUserMessage}
                showThinking={props.showThinking}
              />
              {item.message.role === "assistant" &&
                (props.fileSummariesByMessage?.[item.message.id]?.length ?? 0) > 0 && (
                  <SessionFileSummary
                    files={props.fileSummariesByMessage?.[item.message.id] ?? []}
                    onOpenFile={props.onOpenFile}
                    onDiffFile={props.onDiffFile}
                  />
                )}
            </Fragment>
          ),
      }));

      if (props.awaitingAssistant) {
        baseRows.push({
          key: "__thinking__",
          node: (
            <ThinkingBubble
              thinking={props.activeThinking}
              showThinking={props.showThinking}
            />
          ),
        });
      }

      return baseRows;
    }, [
      props.activeThinking,
      props.awaitingAssistant,
      props.fileSummariesByMessage,
      props.items,
      props.onDiffFile,
      props.onOpenExternal,
      props.onOpenFile,
      props.onPreviewImage,
      props.onResendUserMessage,
      props.onUndoUserMessage,
      props.showThinking,
    ]);

    const keys = useMemo(() => rows.map((item) => item.key), [rows]);

    const prefix = useMemo(() => {
      const offsets: number[] = new Array(rows.length + 1).fill(0);
      for (let i = 0; i < rows.length; i += 1) {
        const height = heightsRef.current.get(rows[i]!.key) ?? DEFAULT_ROW_HEIGHT;
        offsets[i + 1] = offsets[i]! + height;
      }
      return offsets;
    }, [rows, version]);

    const totalHeight = prefix[prefix.length - 1] ?? 0;

    const findIndexAtOffset = useCallback((offset: number) => {
      let low = 0;
      let high = rows.length - 1;
      let answer = 0;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const start = prefix[mid] ?? 0;
        const end = prefix[mid + 1] ?? totalHeight;
        if (offset < start) {
          high = mid - 1;
        } else if (offset >= end) {
          low = mid + 1;
          answer = Math.min(rows.length - 1, mid + 1);
        } else {
          return mid;
        }
      }
      return Math.max(0, answer);
    }, [prefix, rows.length, totalHeight]);

    const visibleRange = useMemo(() => {
      if (rows.length === 0) return { start: 0, end: 0 };
      const startOffset = Math.max(0, scrollTop - OVERSCAN_PX);
      const endOffset = scrollTop + viewportHeight + OVERSCAN_PX;
      const start = findIndexAtOffset(startOffset);
      const end = Math.min(rows.length, findIndexAtOffset(endOffset) + 1);
      return { start, end };
    }, [findIndexAtOffset, rows.length, scrollTop, viewportHeight]);

    const measureRow = useCallback((key: string, node: HTMLDivElement | null) => {
      if (!node) {
        rowRefs.current.delete(key);
        return;
      }
      rowRefs.current.set(key, node);
      const nextHeight = Math.max(node.offsetHeight, 1);
      if (heightsRef.current.get(key) !== nextHeight) {
        heightsRef.current.set(key, nextHeight);
        setVersion((value) => value + 1);
      }
    }, []);

    useLayoutEffect(() => {
      if (!container) return;
      const observer = new ResizeObserver(() => {
        setViewportHeight(container.clientHeight);
      });
      observer.observe(container);
      setViewportHeight(container.clientHeight);
      return () => observer.disconnect();
    }, [container]);

    useEffect(() => {
      if (!container) return;
      const handleScroll = () => {
        setScrollTop(container.scrollTop);
        const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        onScrollStateChangeRef.current?.({ atBottom });
      };
      handleScroll();
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => container.removeEventListener("scroll", handleScroll);
    }, [container]);

    useImperativeHandle(ref, () => ({
      scrollToBottom(behavior = "auto") {
        if (!container) return;
        container.scrollTo({ top: container.scrollHeight, behavior });
      },
      scrollToKey(key: string, behavior = "smooth") {
        if (!container) return;
        const index = keys.indexOf(key);
        if (index < 0) return;
        const top = prefix[index] ?? 0;
        container.scrollTo({ top, behavior });
      },
      isNearBottom() {
        if (!container) return true;
        return container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      },
    }), [container, keys, prefix]);

    const beforeHeight = prefix[visibleRange.start] ?? 0;
    const afterHeight = totalHeight - (prefix[visibleRange.end] ?? totalHeight);

    return (
      <div className={props.className}>
        <div style={{ height: beforeHeight }} />
        {rows.slice(visibleRange.start, visibleRange.end).map((item) => (
          <div key={item.key} ref={(node) => measureRow(item.key, node)} data-virtual-key={item.key}>
            {item.node}
          </div>
        ))}
        <div style={{ height: Math.max(0, afterHeight) }} />
      </div>
    );
  },
);
