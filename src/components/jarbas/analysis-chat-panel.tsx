import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import Markdown from "react-markdown";
import type { AnalysisToolCall, AnalysisTranscript } from "@/lib/analysis";
import { cn } from "@/lib/utils";

function truncateMiddle(value: string, max = 64) {
  if (value.length <= max) return value;
  const keep = Math.floor((max - 1) / 2);
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

function basenamePath(path: string) {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toolBaseName(name: string) {
  return name.split("__").pop() || name;
}

function toolDisplayTitle(tool: AnalysisToolCall): string {
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

  if (
    base === "write" ||
    base === "write_file" ||
    base === "edit" ||
    base === "apply_patch"
  ) {
    const path = firstString(args?.path, args?.file_path, args?.filePath, args?.file);
    if (path) return truncateMiddle(basenamePath(path), 56);
    return tool.label || base;
  }

  if (base === "grep" || base === "rg" || base === "search") {
    const query = firstString(args?.pattern, args?.query, args?.q);
    if (query) return truncateMiddle(query, 56);
    return "search";
  }

  return humanizeToolName(tool.name);
}

function humanizeToolName(name: string): string {
  const base = toolBaseName(name);
  const lower = base.toLowerCase();
  if (lower.includes("composio") && lower.includes("search")) return "Composio search";
  if (lower.includes("composio") && lower.includes("multi")) return "Composio execute";
  if (lower.includes("composio")) return "Composio";
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || "tool";
}

function formatToolArgs(args: unknown) {
  if (args == null) return "";
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
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

function ToolRow({ tool }: { tool: AnalysisToolCall }) {
  const [open, setOpen] = useState(false);
  const title = toolDisplayTitle(tool);
  const input = formatToolArgs(tool.args);
  const output = (tool.result ?? "").trim();
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
          {input ? (
            <pre className="max-h-40 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {input}
            </pre>
          ) : null}
          {output || tool.status === "running" ? (
            <pre className="max-h-48 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground/90">
              {output || "Running…"}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

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
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function AnalysisChatPanel({
  transcript,
  live = false,
  status,
  error,
  promptLabel,
}: {
  transcript: AnalysisTranscript;
  live?: boolean;
  status?: string | null;
  error?: string | null;
  promptLabel: string;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  useEffect(() => {
    if (!live) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [
    live,
    transcript.content,
    transcript.thinking,
    transcript.tools.length,
    status,
  ]);

  const startedAt = transcript.startedAt ?? Date.now();
  const finishedAt = transcript.finishedAt ?? now;
  const durationLabel = formatDuration(finishedAt - startedAt);
  const tools = transcript.tools ?? [];
  const hasBody =
    Boolean(transcript.thinking?.trim()) ||
    Boolean(transcript.content?.trim()) ||
    tools.length > 0;
  const runningTools = tools.filter((tool) => tool.status === "running");
  const visibleTools = live
    ? [
        ...tools.filter((tool) => tool.status === "running"),
        ...tools.filter((tool) => tool.status !== "running").slice(-6),
      ].filter(
        (tool, index, list) => list.findIndex((item) => item.id === tool.id) === index,
      )
    : tools;
  const hiddenToolCount = Math.max(0, tools.length - visibleTools.length);
  // Only show start/stop status — never "Using …" and never while tools already show activity.
  const showStatus =
    live &&
    Boolean(status) &&
    !/^using\b/i.test(status ?? "") &&
    runningTools.length === 0 &&
    (tools.length === 0 || /stopp|start|analyz/i.test(status ?? ""));
  const showThinkingPlaceholder =
    live &&
    !transcript.content?.trim() &&
    runningTools.length === 0 &&
    !transcript.thinking?.trim();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      {!live ? (
        <div className="border border-border bg-muted/30 px-4 py-3">
          <p className="label-caps text-muted-foreground">Analysis run</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Replay of tools, thinking, and output from when this was generated.
          </p>
        </div>
      ) : null}

      <div className="border border-border bg-card px-4 py-3">
        <p className="label-caps text-muted-foreground">Prompt</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {promptLabel}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="label-caps text-muted-foreground">Pi</p>
          <p className="text-[13px] text-muted-foreground tabular-nums">
            {live ? "Running" : "Worked for"} {durationLabel}
            {tools.length > 0 ? (
              <span className="text-muted-foreground/70">
                {" "}
                · {tools.length} {tools.length === 1 ? "tool" : "tools"}
              </span>
            ) : null}
          </p>
        </div>

        {tools.length > 0 ? (
          <div className="mt-3 flex flex-col gap-0.5">
            {hiddenToolCount > 0 ? (
              <p className="py-0.5 text-[13px] text-muted-foreground/70">
                {hiddenToolCount} earlier{" "}
                {hiddenToolCount === 1 ? "tool" : "tools"}
              </p>
            ) : null}
            {visibleTools.map((tool) => (
              <ToolRow key={tool.id} tool={tool} />
            ))}
          </div>
        ) : null}

        {showThinkingPlaceholder ? (
          <p className="mt-4 animate-thinking text-sm text-muted-foreground">
            Thinking…
          </p>
        ) : null}

        {!live && transcript.thinking?.trim() ? (
          <details className="mt-4 group">
            <summary className="cursor-pointer text-[13px] text-muted-foreground hover:text-foreground">
              Thinking
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-muted-foreground">
              {transcript.thinking}
            </pre>
          </details>
        ) : null}

        {transcript.content?.trim() ? (
          <div className="mt-4">
            <AssistantMarkdown content={transcript.content} />
          </div>
        ) : null}

        {showStatus ? (
          <p className="mt-4 animate-thinking text-sm text-muted-foreground">
            {status}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {!live && !hasBody && !error ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No analysis transcript was saved for this result.
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
