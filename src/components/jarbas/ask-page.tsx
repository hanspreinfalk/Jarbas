import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { ArrowUp, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PIN_TOP_GAP = 30;

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
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

function replyFor(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("yesterday") || lower.includes("time")) {
    return "Yesterday clustered around partner billing close work in Sheets, with short Slack and Linear status hops in between. The deepest block was match review before the Finance exception pass.";
  }
  if (lower.includes("automat") || lower.includes("workflow")) {
    return "Strong unlocks right now: Drive intake for the four partner workbooks, the discovery follow-up template pack, and a frozen demo snapshot. Intake and follow-ups look ready within two weeks.";
  }
  if (lower.includes("call") || lower.includes("theme")) {
    return "Recent call themes: two-week delivery clarity, ROI one-pager requests, and interest in exception brief packs. Meridian and similar buyers keep asking for a shareable sketch.";
  }
  if (lower.includes("ship") || lower.includes("week") || lower.includes("next")) {
    return "Prioritize the partner-billing delivery one-pager and follow-up template pack this week. Both are high impact, low effort, and reinforce the two-week delivery story.";
  }
  return "I can pull from your recordings, learnings, and opportunities. Ask about time spent, workflows to unlock, call themes, or what to ship next.";
}

function Composer({
  draft,
  sending,
  inputRef,
  onDraftChange,
  onKeyDown,
  onSubmit,
  placeholder = "Ask Jarbas…",
}: {
  draft: string;
  sending: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  placeholder?: string;
}) {
  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
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
          className="max-h-32 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 pr-12 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!draft.trim() || sending}
          className="absolute right-1.5 bottom-1.5 size-8 rounded-none"
          aria-label="Send"
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </form>
  );
}

export function AskPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [replyRoom, setReplyRoom] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const turnEndRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const pinScrollRef = useRef(false);

  const hasStarted = messages.length > 0;

  useLayoutEffect(() => {
    if (!pinnedUserId) {
      setReplyRoom(0);
      return;
    }

    const viewport = viewportRef.current;
    const messageEl = messageRefs.current.get(pinnedUserId);
    const turnEnd = turnEndRef.current;
    if (!viewport || !messageEl || !turnEnd) return;

    // Size the spacer from the full turn (user + thinking/reply),
    // so scrolling to the bottom still keeps the user message on screen.
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
      // Clipboard can fail in restricted contexts; ignore quietly.
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const now = Date.now();
    const userMessage: ChatMessage = {
      id: `user-${now}`,
      role: "user",
      content: trimmed,
      createdAt: now,
    };

    setMessages((current) => [...current, userMessage]);
    setPinnedUserId(userMessage.id);
    pinScrollRef.current = true;
    setDraft("");
    setSending(true);

    await new Promise((resolve) => window.setTimeout(resolve, 700));

    const repliedAt = Date.now();
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${repliedAt}`,
        role: "assistant",
        content: replyFor(trimmed),
        createdAt: repliedAt,
      },
    ]);
    setSending(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  }

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
          </div>

          <div className="mt-8">
            <Composer
              draft={draft}
              sending={sending}
              inputRef={inputRef}
              onDraftChange={setDraft}
              onKeyDown={onKeyDown}
              onSubmit={() => void sendMessage(draft)}
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
              <div
                className={cn(
                  "max-w-[85%] text-sm leading-relaxed",
                  message.role === "user"
                    ? "border border-foreground bg-foreground px-3 py-2 text-background"
                    : "text-foreground",
                )}
              >
                {message.role === "assistant" ? (
                  <p className="label-caps mb-1.5 text-[10px] text-muted-foreground">
                    Jarbas
                  </p>
                ) : null}
                <p>{message.content}</p>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 px-0.5",
                  message.role === "user" ? "flex-row-reverse" : "flex-row",
                )}
              >
                <time
                  dateTime={new Date(message.createdAt).toISOString()}
                  className="text-[11px] text-muted-foreground"
                >
                  {formatMessageTime(message.createdAt)}
                </time>
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
              </div>
            </div>
          ))}

          {sending ? (
            <div className="animate-fade-soft flex flex-col items-start gap-1">
              <p className="label-caps text-[10px] text-muted-foreground">
                Jarbas
              </p>
              <p className="text-shimmer text-sm">Thinking…</p>
            </div>
          ) : null}

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
            onDraftChange={setDraft}
            onKeyDown={onKeyDown}
            onSubmit={() => void sendMessage(draft)}
          />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Your data stays private and local on this device.
          </p>
        </div>
      </div>
    </div>
  );
}
