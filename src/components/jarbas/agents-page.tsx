import { useState } from "react";
import { ArrowLeft, Bot } from "lucide-react";
import { AppBadgeList } from "@/components/jarbas/app-badge";
import { Button } from "@/components/ui/button";
import {
  MOCK_AGENTS,
  type Agent,
  type AgentStatus,
} from "@/lib/mock-agents";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<AgentStatus, string> = {
  running: "Running",
  idle: "Idle",
  needs_review: "Needs review",
  queued: "Queued",
};

function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={cn(
        "label-caps border px-1.5 py-0.5 text-[10px]",
        status === "running"
          ? "border-foreground bg-foreground text-background"
          : status === "needs_review"
            ? "border-border bg-sky text-navy"
            : "border-border bg-muted text-muted-foreground",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function AgentDetail({
  agent,
  onBack,
}: {
  agent: Agent;
  onBack: () => void;
}) {
  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-2 rounded-none text-muted-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All agents
      </Button>

      <header className="mt-4 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={agent.status} />
          <span className="text-xs text-muted-foreground">
            {agent.runs7d} runs · 7d
          </span>
          <span className="text-xs text-muted-foreground">
            Success {agent.successRate}
          </span>
        </div>
        <h1 className="mt-3 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
          {agent.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{agent.covers}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Owner {agent.owner} · Avg duration {agent.avgDuration}
        </p>
      </header>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Latest result</h2>
        <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
          {agent.summary}
        </p>
        <p className="text-sm text-muted-foreground">
          Last run · {agent.lastRunAt} · {agent.lastRun}
        </p>
      </section>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Instructions</h2>
        <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
          {agent.instructions}
        </p>
      </section>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Skills</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-foreground">
          {agent.skills.map((skill) => (
            <li key={skill} className="border border-border bg-card px-3 py-2">
              {skill}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Triggers</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
          {agent.triggers.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 grid gap-6 border-t border-border pt-8 sm:grid-cols-2">
        <div className="space-y-2">
          <h2 className="label-caps text-muted-foreground">Approvals</h2>
          <ul className="space-y-2 text-sm leading-relaxed text-foreground">
            {agent.approvals.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h2 className="label-caps text-muted-foreground">Related opportunity</h2>
          <p className="text-sm leading-relaxed text-foreground">
            {agent.relatedOpportunity}
          </p>
        </div>
      </section>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Evals</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-foreground">
          {agent.evals.map((item) => (
            <li key={item} className="border border-border bg-card px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Tools</h2>
        <AppBadgeList apps={agent.tools} />
      </section>
    </div>
  );
}

export function AgentsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = MOCK_AGENTS.find((agent) => agent.id === selectedId);

  if (selected) {
    return (
      <AgentDetail agent={selected} onBack={() => setSelectedId(null)} />
    );
  }

  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="min-w-0">
        <p className="label-caps text-muted-foreground">Jarbas</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          Agents
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Your automations - what they cover, when they last ran, and how they finished.
        </p>
      </div>

      <ul className="mt-10 divide-y divide-border border border-border bg-card">
        {MOCK_AGENTS.map((agent, index) => (
          <li key={agent.id}>
            <button
              type="button"
              onClick={() => setSelectedId(agent.id)}
              className="animate-rise w-full px-4 py-4 text-left transition-colors hover:bg-muted sm:px-5"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-foreground">
                  <Bot className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={agent.status} />
                    <span className="text-xs text-muted-foreground">
                      {agent.runs7d} runs · 7d
                    </span>
                  </div>

                  <h2 className="mt-2 text-sm font-semibold tracking-tight text-foreground sm:text-base">
                    {agent.name}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {agent.covers}
                  </p>

                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Last run · </span>
                    {agent.lastRunAt}
                    <span className="text-muted-foreground/70"> · </span>
                    {agent.lastRun}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Trigger · </span>
                    {agent.trigger}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
                    <span className="font-medium">Result · </span>
                    {agent.summary}
                  </p>

                  <AppBadgeList apps={agent.tools} className="mt-3" />
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
