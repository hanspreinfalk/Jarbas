import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Square,
} from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { useQuery } from "convex/react";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { ModelPicker } from "@/components/jarbas/model-picker";
import {
  askAbort,
  askSendPrompt,
  listenAskEvents,
  type AskEvent,
} from "@/lib/ask-chat";
import {
  getLlmSettings,
  setLlmModel,
  type LlmProvider,
  type LlmSettings,
} from "@/lib/llm-settings";
import {
  getPiAgentStatus,
  listenPiAgentStatus,
  type PiAgentStatus,
} from "@/lib/pi-agent";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed text-foreground">
      <Markdown
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className?.includes("language-"));
            if (isBlock) {
              return (
                <code className="font-mono text-[12px] text-foreground">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto border border-border bg-muted/50 p-3 last:mb-0">
              {children}
            </pre>
          ),
          h1: ({ children }) => (
            <h1 className="mb-2 font-display text-xl tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 font-display text-lg tracking-tight">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 text-base font-semibold tracking-tight">
              {children}
            </h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-border pl-3 text-muted-foreground last:mb-0">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

function askAssistantHint(status: PiAgentStatus): string {
  switch (status.kind) {
    case "installing":
      return "Setting up assistant…";
    case "failed":
      return "Assistant needs setup in Settings.";
    case "idle":
      return "Assistant is not ready yet.";
    case "ready":
      return "";
  }
}

const PIN_TOP_GAP = 30;

type ChatRole = "user" | "assistant";

type ToolCallState = {
  id: string;
  name: string;
  label: string;
  args: unknown;
  status: "running" | "done" | "error";
  result: string;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  thinking?: string;
  tools?: ToolCallState[];
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
};

const SUGGESTIONS = [
  "What did I spend the most time on yesterday?",
  "Which workflows look ready to automate?",
  "Summarize my last discovery call themes.",
  "What should I ship in the next two weeks?",
];

function formatMessageTime(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) return time;

  const day = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  return `${day} · ${time}`;
}

function formatWorkDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    if (minutes === 0 && seconds === 0) return `${hours}h`;
    if (seconds === 0) return `${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    if (seconds === 0) return `${minutes}m`;
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatToolArgs(args: unknown): string {
  if (args == null) return "";
  if (typeof args === "string") return args;
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return true;
  }
  return /"\s*:/.test(trimmed);
}

function highlightJsonText(text: string) {
  const nodes: ReactNode[] = [];
  const pattern =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [token, stringLiteral, colonAfter, keyword] = match;
    if (stringLiteral !== undefined) {
      if (colonAfter !== undefined) {
        nodes.push(
          <span key={key++} className="text-primary">
            {stringLiteral}
          </span>,
        );
        nodes.push(
          <span key={key++} className="text-muted-foreground/70">
            {colonAfter}
          </span>,
        );
      } else {
        nodes.push(
          <span key={key++} className="text-emerald-700">
            {stringLiteral}
          </span>,
        );
      }
    } else if (keyword !== undefined) {
      nodes.push(
        <span key={key++} className="text-sky-800">
          {keyword}
        </span>,
      );
    } else if (/^-?\d/.test(token)) {
      nodes.push(
        <span key={key++} className="text-amber-700">
          {token}
        </span>,
      );
    } else {
      nodes.push(
        <span key={key++} className="text-muted-foreground/70">
          {token}
        </span>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function ToolPayload({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const colored = looksLikeJson(text) ? highlightJsonText(text) : text;
  return (
    <pre
      className={cn(
        "max-h-48 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground",
        className,
      )}
    >
      {colored}
    </pre>
  );
}

function ToolGlyph({
  running,
  failed,
}: {
  running?: boolean;
  failed?: boolean;
}) {
  return (
    <span
      className={cn(
        "mt-0.5 inline-grid shrink-0 grid-cols-2 gap-[2px] text-muted-foreground/70",
        running && "animate-pulse text-muted-foreground",
        failed && "text-destructive/80",
      )}
      aria-hidden
    >
      <span className="size-[3px] rounded-full bg-current" />
      <span className="size-[3px] rounded-full bg-current" />
      <span className="size-[3px] rounded-full bg-current" />
      <span className="size-[3px] rounded-full bg-current" />
    </span>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function truncateMiddle(value: string, max = 72): string {
  if (value.length <= max) return value;
  const keep = Math.floor((max - 1) / 2);
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

function basenamePath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || path;
}

function toolBaseName(name: string): string {
  return name.split("__").pop() || name;
}

function humanizeToolName(name: string): string {
  const base = toolBaseName(name);
  const lower = base.toLowerCase();
  if (lower.includes("composio") && lower.includes("search")) return "Composio search";
  if (lower.includes("composio") && lower.includes("multi")) return "Composio execute";
  if (lower.includes("composio")) return "Composio";
  const cleaned = base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "tool";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function toolDisplayTitle(tool: ToolCallState): string {
  const base = toolBaseName(tool.name).toLowerCase();
  const args = asRecord(tool.args);

  if (base === "bash" || base === "shell" || base === "run_terminal_cmd") {
    const command = firstString(args?.command, args?.cmd, args?.script);
    if (command) {
      const oneLine = command.split(/\r?\n/)[0]?.trim() || command;
      return truncateMiddle(oneLine, 68);
    }
    return "bash";
  }

  if (base === "read" || base === "read_file") {
    const path = firstString(args?.path, args?.file_path, args?.filePath, args?.file);
    if (path) return truncateMiddle(basenamePath(path), 56);
    return "read";
  }

  if (base === "write" || base === "write_file" || base === "edit" || base === "apply_patch") {
    const path = firstString(args?.path, args?.file_path, args?.filePath, args?.file);
    if (path) return truncateMiddle(basenamePath(path), 56);
    return humanizeToolName(tool.name);
  }

  if (base === "grep" || base === "rg" || base === "search") {
    const query = firstString(args?.pattern, args?.query, args?.q);
    if (query) return truncateMiddle(query, 56);
    return "search";
  }

  return humanizeToolName(tool.name);
}

function ToolRow({ tool }: { tool: ToolCallState }) {
  const [open, setOpen] = useState(false);
  const title = toolDisplayTitle(tool);
  const input = formatToolArgs(tool.args);
  const output = tool.result.trim();
  const hasDetails = Boolean(input || output);
  const failed = tool.status === "error";

  return (
    <div className="min-w-0">
      <button
        type="button"
        className={cn(
          "group flex w-full min-w-0 items-start gap-2 py-0.5 text-left text-[13px] leading-snug transition-colors",
          failed
            ? "text-destructive/90 hover:text-destructive"
            : "text-muted-foreground hover:text-foreground",
          !hasDetails && "cursor-default",
        )}
        onClick={() => {
          if (hasDetails) setOpen((current) => !current);
        }}
        disabled={!hasDetails}
      >
        <ToolGlyph running={tool.status === "running"} failed={failed} />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            tool.status === "running" && "animate-thinking",
          )}
        >
          {title}
        </span>
        {hasDetails ? (
          <ChevronDown
            className={cn(
              "mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 opacity-0 transition-all group-hover:opacity-100",
              open && "rotate-180 opacity-100",
            )}
          />
        ) : null}
      </button>
      {open && hasDetails ? (
        <div className="mt-1 mb-1.5 ml-[14px] space-y-2 border-l border-border/70 pl-3">
          {input ? <ToolPayload text={input} className="max-h-40" /> : null}
          {output || tool.status === "running" ? (
            <ToolPayload
              text={output || "Running…"}
              className="max-h-48 text-muted-foreground/90"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolActivityList({
  tools,
  live = false,
}: {
  tools: ToolCallState[];
  live?: boolean;
}) {
  const visible = live
    ? [
        ...tools.filter((tool) => tool.status === "running"),
        ...tools.filter((tool) => tool.status !== "running").slice(-6),
      ].filter(
        (tool, index, list) => list.findIndex((item) => item.id === tool.id) === index,
      )
    : tools;
  const hidden = Math.max(0, tools.length - visible.length);

  return (
    <div className="flex flex-col gap-0.5">
      {hidden > 0 ? (
        <p className="py-0.5 text-[13px] text-muted-foreground/70">
          {hidden} earlier {hidden === 1 ? "tool" : "tools"}
        </p>
      ) : null}
      {visible.map((tool) => (
        <ToolRow key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

function WorkedForDetails({
  durationLabel,
  tools,
  live = false,
}: {
  durationLabel: string;
  tools: ToolCallState[];
  live?: boolean;
}) {
  const [open, setOpen] = useState(live);
  const toolCount = tools.length;
  const collapsible = toolCount > 0;
  const prefix = live ? "Running" : "Worked for";
  const showTools = collapsible && (live || open);

  if (!collapsible) {
    return (
      <p
        className={cn(
          "text-[13px] text-muted-foreground",
          live && "tabular-nums",
        )}
      >
        {prefix} {durationLabel}
      </p>
    );
  }

  return (
    <div className="min-w-0">
      {live ? (
        <p className="truncate text-[13px] text-muted-foreground tabular-nums">
          {prefix} {durationLabel}
          <span className="text-muted-foreground/70">
            {" "}
            · {toolCount} {toolCount === 1 ? "tool" : "tools"}
          </span>
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="group inline-flex max-w-full items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="truncate">
            {prefix} {durationLabel}
            <span className="text-muted-foreground/70">
              {" "}
              · {toolCount} {toolCount === 1 ? "tool" : "tools"}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/50 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      )}
      {showTools ? (
        <div className="mt-1.5">
          <ToolActivityList tools={tools} live={live} />
        </div>
      ) : null}
    </div>
  );
}

function Composer({
  draft,
  sending,
  inputRef,
  llmSettings,
  onDraftChange,
  onKeyDown,
  onSubmit,
  onStop,
  onModelSelect,
  placeholder = "Ask Jarbas…",
}: {
  draft: string;
  sending: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  llmSettings: LlmSettings | null;
  onDraftChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onStop: () => void;
  onModelSelect: (provider: LlmProvider, model: string) => void;
  placeholder?: string;
}) {
  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        if (sending) return;
        onSubmit();
      }}
    >
      <div className="relative min-w-0 border border-border bg-card">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={placeholder}
          className="max-h-32 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 pr-[9.5rem] pb-12 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="absolute right-1.5 bottom-1.5 flex items-center gap-1.5">
          <ModelPicker
            settings={llmSettings}
            disabled={sending}
            onSelect={onModelSelect}
          />
          {sending ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8 rounded-none"
              aria-label="Stop"
              onClick={onStop}
            >
              <Square className="size-3 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim()}
              className="size-8 rounded-none"
              aria-label="Send"
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

export function AskPage() {
  const { user } = useUser();
  const me = useQuery(api.user.me);
  const composioUserId =
    me?.user?.composioUserId ?? user?.id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [replyRoom, setReplyRoom] = useState(0);
  const [piStatus, setPiStatus] = useState<PiAgentStatus | null>(null);
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const turnEndRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const pinScrollRef = useRef(false);
  const assistantIdRef = useRef<string | null>(null);
  const applyAskEventRef = useRef<(event: AskEvent) => void>(() => {});

  const hasStarted = messages.length > 0;

  useEffect(() => {
    let cancelled = false;
    let unlistenStatus: (() => void) | undefined;
    let unlistenAsk: (() => void) | undefined;

    void (async () => {
      try {
        const [info, llm] = await Promise.all([
          getPiAgentStatus(),
          getLlmSettings(),
        ]);
        if (!cancelled) {
          setPiStatus(info.status);
          setLlmSettings(llm);
        }
        unlistenStatus = await listenPiAgentStatus((status) => {
          if (!cancelled) setPiStatus(status);
        });
        unlistenAsk = await listenAskEvents((event) => {
          if (!cancelled) applyAskEventRef.current(event);
        });
      } catch (error) {
        console.error("Failed to load Ask runtime settings", error);
      }
    })();

    return () => {
      cancelled = true;
      unlistenStatus?.();
      unlistenAsk?.();
    };
  }, []);

  useEffect(() => {
    if (!sending) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [sending]);

  function patchAssistant(
    updater: (message: ChatMessage) => ChatMessage,
  ) {
    const id = assistantIdRef.current;
    if (!id) return;
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? updater(message) : message,
      ),
    );
  }

  function finishAssistant() {
    const finishedAt = Date.now();
    const id = assistantIdRef.current;
    setMessages((current) => {
      const targetId =
        id ??
        [...current]
          .reverse()
          .find(
            (message) =>
              message.role === "assistant" && message.finishedAt == null,
          )?.id;
      if (!targetId) return current;
      return current.map((message) =>
        message.id === targetId
          ? {
              ...message,
              createdAt: finishedAt,
              finishedAt: message.finishedAt ?? finishedAt,
            }
          : message,
      );
    });
    setSending(false);
    assistantIdRef.current = null;
    inputRef.current?.focus();
  }

  function applyAskEvent(event: AskEvent) {
    switch (event.type) {
      case "agentStart":
        setSending(true);
        setStreamError(null);
        break;
      case "textDelta":
        patchAssistant((message) => ({
          ...message,
          content: `${message.content}${event.delta}`,
        }));
        break;
      case "thinkingDelta":
        patchAssistant((message) => ({
          ...message,
          thinking: `${message.thinking ?? ""}${event.delta}`,
        }));
        break;
      case "toolStart":
        patchAssistant((message) => {
          const tools = [...(message.tools ?? [])];
          const existing = tools.findIndex((tool) => tool.id === event.toolCallId);
          const next: ToolCallState = {
            id: event.toolCallId,
            name: event.toolName,
            label: event.label,
            args: event.args,
            status: "running",
            result: "",
          };
          if (existing >= 0) tools[existing] = next;
          else tools.push(next);
          return { ...message, tools };
        });
        break;
      case "toolUpdate":
        patchAssistant((message) => ({
          ...message,
          tools: (message.tools ?? []).map((tool) =>
            tool.id === event.toolCallId
              ? { ...tool, result: event.partialResult, status: "running" }
              : tool,
          ),
        }));
        break;
      case "toolEnd":
        patchAssistant((message) => ({
          ...message,
          tools: (message.tools ?? []).map((tool) =>
            tool.id === event.toolCallId
              ? {
                  ...tool,
                  result: event.result || tool.result,
                  status: event.isError ? "error" : "done",
                }
              : tool,
          ),
        }));
        break;
      case "error":
        setStreamError(event.message);
        patchAssistant((message) => {
          const finishedAt = Date.now();
          return {
            ...message,
            error: event.message,
            content:
              message.content ||
              "Something went wrong while talking to the assistant.",
            createdAt: finishedAt,
            finishedAt,
          };
        });
        if (
          event.message.toLowerCase().includes("stopped") ||
          event.message.toLowerCase().includes("timed out")
        ) {
          finishAssistant();
        }
        break;
      case "agentSettled":
        finishAssistant();
        break;
    }
  }

  applyAskEventRef.current = applyAskEvent;

  async function onModelSelect(provider: LlmProvider, model: string) {
    try {
      const next = await setLlmModel(provider, model);
      setLlmSettings(next);
    } catch (error) {
      console.error("Failed to save model selection", error);
    }
  }

  useLayoutEffect(() => {
    if (!pinnedUserId) {
      setReplyRoom(0);
      return;
    }

    const viewport = viewportRef.current;
    const messageEl = messageRefs.current.get(pinnedUserId);
    const turnEnd = turnEndRef.current;
    if (!viewport || !messageEl || !turnEnd) return;

    const turnHeight = Math.max(
      turnEnd.offsetTop - messageEl.offsetTop,
      messageEl.offsetHeight,
    );
    const room = Math.max(
      viewport.clientHeight - turnHeight - PIN_TOP_GAP,
      0,
    );
    setReplyRoom((current) => (current === room ? current : room));
  }, [pinnedUserId, sending, messages]);

  useLayoutEffect(() => {
    if (!pinnedUserId || !pinScrollRef.current) return;

    const viewport = viewportRef.current;
    const messageEl = messageRefs.current.get(pinnedUserId);
    if (!viewport || !messageEl) return;

    const viewportTop = viewport.getBoundingClientRect().top;
    const messageTop = messageEl.getBoundingClientRect().top;
    const delta = messageTop - viewportTop - PIN_TOP_GAP;
    if (Math.abs(delta) > 1) {
      viewport.scrollBy({ top: delta, behavior: "smooth" });
    }
    pinScrollRef.current = false;
  }, [pinnedUserId, replyRoom]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current != null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      if (copyTimerRef.current != null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedId(null);
        copyTimerRef.current = null;
      }, 1500);
    } catch {
      // ignore
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (llmSettings && !llmSettings.keys.some((item) => item.configured)) {
      setStreamError("Add an API key in Settings first.");
      return;
    }

    const now = Date.now();
    const userMessage: ChatMessage = {
      id: `user-${now}`,
      role: "user",
      content: trimmed,
      createdAt: now,
    };
    const assistantId = `assistant-${now}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      thinking: "",
      tools: [],
      createdAt: now,
      startedAt: now,
    };

    assistantIdRef.current = assistantId;
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setPinnedUserId(userMessage.id);
    pinScrollRef.current = true;
    setDraft("");
    setSending(true);
    setStreamError(null);

    try {
      await askSendPrompt(trimmed, { composioUserId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      setStreamError(message);
      patchAssistant((current) => ({
        ...current,
        error: message,
        content:
          current.content ||
          "Could not reach the assistant. Check Settings and try again.",
      }));
      finishAssistant();
    }
  }

  async function stopTurn() {
    try {
      await askAbort();
    } catch (error) {
      console.error("Failed to abort", error);
    } finally {
      finishAssistant();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  }

  function renderAssistantBody(message: ChatMessage) {
    const tools = message.tools ?? [];
    const hasTools = tools.length > 0;
    const isLive = sending && assistantIdRef.current === message.id;
    const showThinking = isLive && !message.content.trim() && !hasTools;
    const startedAt = message.startedAt ?? message.createdAt;
    const endedAt = message.finishedAt ?? (!isLive ? Date.now() : null);
    const elapsedMs = isLive
      ? Math.max(0, nowMs - startedAt)
      : Math.max(0, (endedAt ?? startedAt) - startedAt);
    const durationLabel = formatWorkDuration(elapsedMs);
    const showWorkSummary =
      isLive ||
      Boolean(
        message.content.trim() || hasTools || message.error || message.finishedAt,
      );

    const showReply =
      Boolean(message.content.trim()) ||
      Boolean(message.error) ||
      showThinking;

    return (
      <div className="flex w-full max-w-[92%] flex-col gap-3">
        {showWorkSummary ? (
          <WorkedForDetails
            durationLabel={durationLabel}
            tools={tools}
            live={isLive}
          />
        ) : null}

        {showWorkSummary && showReply ? (
          <div className="border-t border-border/70" />
        ) : null}

        {showThinking ? (
          <p className="animate-thinking text-sm text-muted-foreground">
            Thinking…
          </p>
        ) : null}

        {message.content.trim() ? (
          <AssistantMarkdown content={message.content} />
        ) : null}

        {message.error ? (
          <p className="text-xs text-destructive">{message.error}</p>
        ) : null}
      </div>
    );
  }

  const footerHint =
    streamError ||
    (piStatus && piStatus.kind !== "ready"
      ? askAssistantHint(piStatus)
      : llmSettings && !llmSettings.keys.some((item) => item.configured)
        ? "Add an API key in Settings to use Ask."
        : "Your data stays private and local on this device.");

  if (!hasStarted) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-rise mx-auto w-full max-w-xl">
          <div className="text-center">
            <p className="label-caps text-muted-foreground">Ask</p>
            <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
              Ask anything about your data
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Recordings, learnings, opportunities - all private and local.
            </p>
            {piStatus && piStatus.kind !== "ready" ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {askAssistantHint(piStatus)}
              </p>
            ) : null}
            {streamError ? (
              <p className="mt-2 text-xs text-destructive">{streamError}</p>
            ) : null}
          </div>

          <div className="mt-8">
            <Composer
              draft={draft}
              sending={sending}
              inputRef={inputRef}
              llmSettings={llmSettings}
              onDraftChange={setDraft}
              onKeyDown={onKeyDown}
              onSubmit={() => void sendMessage(draft)}
              onStop={() => void stopTurn()}
              onModelSelect={(provider, model) =>
                void onModelSelect(provider, model)
              }
              placeholder="Ask about your work…"
            />
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={sending}
                onClick={() => void sendMessage(suggestion)}
                className="border border-border bg-background px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={viewportRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {messages.map((message) => (
            <div
              key={message.id}
              ref={(node) => {
                if (node) messageRefs.current.set(message.id, node);
                else messageRefs.current.delete(message.id);
              }}
              className={cn(
                "animate-rise flex w-full flex-col gap-1",
                message.role === "user" ? "items-end" : "items-start",
              )}
            >
              {message.role === "user" ? (
                <div className="max-w-[85%] border border-foreground bg-foreground px-3 py-2 text-sm leading-relaxed text-background">
                  <p>{message.content}</p>
                </div>
              ) : (
                renderAssistantBody(message)
              )}
              <div
                className={cn(
                  "flex items-center gap-1.5 px-0.5",
                  message.role === "user" ? "flex-row-reverse" : "flex-row",
                )}
              >
                {message.role === "user" ||
                !(
                  sending && assistantIdRef.current === message.id
                ) ? (
                  <time
                    dateTime={new Date(message.createdAt).toISOString()}
                    className="text-[11px] text-muted-foreground"
                  >
                    {formatMessageTime(message.createdAt)}
                  </time>
                ) : null}
                {message.content.trim() ? (
                  <button
                    type="button"
                    onClick={() => void copyMessage(message)}
                    className="inline-flex size-5 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={
                      copiedId === message.id ? "Copied" : "Copy message"
                    }
                    title={copiedId === message.id ? "Copied" : "Copy"}
                  >
                    {copiedId === message.id ? (
                      <Check className="size-3" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          ))}

          <div ref={turnEndRef} aria-hidden className="h-0" />
          <div
            aria-hidden
            className="shrink-0"
            style={{ minHeight: replyRoom }}
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-sm sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <Composer
            draft={draft}
            sending={sending}
            inputRef={inputRef}
            llmSettings={llmSettings}
            onDraftChange={setDraft}
            onKeyDown={onKeyDown}
            onSubmit={() => void sendMessage(draft)}
            onStop={() => void stopTurn()}
            onModelSelect={(provider, model) =>
              void onModelSelect(provider, model)
            }
          />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {footerHint}
          </p>
        </div>
      </div>
    </div>
  );
}
