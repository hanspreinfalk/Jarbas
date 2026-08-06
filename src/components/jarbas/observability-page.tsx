import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppBadgeList } from "@/components/jarbas/app-badge";
import { Button } from "@/components/ui/button";
import {
  MOCK_AGENT_RUNS,
  type AgentRun,
  type AgentRunEvent,
  type AgentRunStatus,
  type AgentRunStepStatus,
} from "@/lib/mock-agent-runs";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<AgentRunStatus, string> = {
  running: "Running",
  completed: "Completed",
  needs_review: "Needs review",
  failed: "Failed",
};

const STEP_LABEL: Record<AgentRunStepStatus, string> = {
  done: "Done",
  active: "Active",
  pending: "Pending",
  failed: "Failed",
};

function StatusBadge({ status }: { status: AgentRunStatus }) {
  return (
    <span
      className={cn(
        "label-caps inline-block border px-1.5 py-0.5 text-[10px]",
        status === "running"
          ? "border-foreground bg-foreground text-background"
          : status === "needs_review"
            ? "border-border bg-sky text-navy"
            : status === "failed"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-muted text-muted-foreground",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function StepBadge({ status }: { status: AgentRunStepStatus }) {
  return (
    <span
      className={cn(
        "label-caps inline-block border px-1.5 py-0.5 text-[10px]",
        status === "active"
          ? "border-foreground bg-foreground text-background"
          : status === "failed"
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : status === "done"
              ? "border-border bg-muted text-muted-foreground"
              : "border-border bg-background text-muted-foreground",
      )}
    >
      {STEP_LABEL[status]}
    </span>
  );
}

function EventLevel({ level }: { level: AgentRunEvent["level"] }) {
  return (
    <span
      className={cn(
        "label-caps inline-block border px-1.5 py-0.5 text-[10px]",
        level === "error"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : level === "warn"
            ? "border-border bg-sky text-navy"
            : "border-border bg-muted text-muted-foreground",
      )}
    >
      {level}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card px-3 py-3">
      <p className="label-caps text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function RunDetail({
  run,
  onBack,
}: {
  run: AgentRun;
  onBack: () => void;
}) {
  return (
    <div className="animate-rise mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-2 rounded-none text-muted-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All runs
      </Button>

      <header className="mt-4 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={run.status} />
          <span className="text-xs text-muted-foreground">{run.startedAt}</span>
          <span className="text-xs text-muted-foreground">{run.duration}</span>
        </div>
        <h1 className="mt-3 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
          {run.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{run.agent}</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground sm:text-[15px]">
          {run.summary}
        </p>
        {run.nextAction ? (
          <p className="mt-3 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Next · </span>
            {run.nextAction}
          </p>
        ) : null}
      </header>

      <section className="mt-8 border-t border-border pt-8">
        <p className="label-caps text-primary">Overview</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Trigger" value={run.trigger} />
          <Metric label="Owner" value={run.owner} />
          <Metric label="Workspace" value={run.workspace} />
          <Metric label="Model" value={run.model} />
          <Metric label="Cost" value={run.cost} />
          <Metric label="Tokens in" value={run.tokensIn} />
          <Metric label="Tokens out" value={run.tokensOut} />
          <Metric label="Steps" value={String(run.steps)} />
        </div>
      </section>

      <section className="mt-8 border-t border-border pt-8">
        <p className="label-caps text-primary">Timeline</p>
        <ol className="mt-3 divide-y divide-border border border-border bg-card">
          {run.timeline.map((step) => (
            <li
              key={step.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {step.label}
                  </p>
                  <StepBadge status={step.status} />
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {step.detail}
                </p>
              </div>
              <div className="shrink-0 text-left text-xs text-muted-foreground sm:text-right">
                <p>{step.at}</p>
                {step.duration ? <p className="mt-0.5">{step.duration}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 grid gap-8 border-t border-border pt-8 sm:grid-cols-2">
        <div>
          <p className="label-caps text-primary">Inputs</p>
          <ul className="mt-3 space-y-2">
            {run.inputs.map((item) => (
              <li
                key={item}
                className="border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label-caps text-primary">Outputs</p>
          <ul className="mt-3 space-y-2">
            {run.outputs.map((item) => (
              <li
                key={item}
                className="border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8 border-t border-border pt-8">
        <p className="label-caps text-primary">Tools</p>
        <AppBadgeList apps={run.tools} className="mt-3" />
      </section>

      <section className="mt-8 border-t border-border pt-8">
        <p className="label-caps text-primary">Event log</p>
        <ul className="mt-3 divide-y divide-border border border-border bg-card">
          {run.events.map((event) => (
            <li
              key={event.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
            >
              <div className="flex shrink-0 items-center gap-2 sm:w-28">
                <EventLevel level={event.level} />
                <span className="text-xs text-muted-foreground">{event.at}</span>
              </div>
              <p className="min-w-0 text-sm leading-relaxed text-foreground">
                {event.message}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function ObservabilityPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = MOCK_AGENT_RUNS.find((run) => run.id === selectedId);

  if (selected) {
    return (
      <RunDetail run={selected} onBack={() => setSelectedId(null)} />
    );
  }

  return (
    <div className="animate-rise mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="min-w-0">
        <p className="label-caps text-muted-foreground">Jarbas</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          Observability
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Agent runs at a glance.
        </p>
      </div>

      <div className="mt-10 overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="label-caps px-3 py-2.5 font-medium text-muted-foreground">
                Status
              </th>
              <th className="label-caps px-3 py-2.5 font-medium text-muted-foreground">
                Run
              </th>
              <th className="label-caps px-3 py-2.5 font-medium text-muted-foreground">
                Agent
              </th>
              <th className="label-caps px-3 py-2.5 font-medium text-muted-foreground">
                Started
              </th>
              <th className="label-caps px-3 py-2.5 font-medium text-muted-foreground">
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {MOCK_AGENT_RUNS.map((run) => (
              <tr
                key={run.id}
                tabIndex={0}
                role="button"
                onClick={() => setSelectedId(run.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(run.id);
                  }
                }}
                className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
              >
                <td className="px-3 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-3 py-3 font-medium text-foreground">
                  {run.title}
                </td>
                <td className="px-3 py-3 text-muted-foreground">{run.agent}</td>
                <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                  {run.startedAt}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-foreground">
                  {run.duration}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
