import { Square } from "lucide-react";
import { useAnalysisRun } from "@/components/jarbas/analysis-run-provider";
import { Button } from "@/components/ui/button";
import type { AppTabId } from "@/lib/app-tabs";
import {
  friendlyKindReady,
  friendlyKindVerb,
  friendlyKindViewLabel,
} from "@/lib/friendly-analysis";
import { cn } from "@/lib/utils";

const KIND_TAB: Record<
  "insights" | "opportunities" | "reports" | "team-reports",
  AppTabId
> = {
  insights: "insights",
  opportunities: "opportunities",
  reports: "reports",
  "team-reports": "multi-team-analysis",
};

export function AnalysisRunBanner({
  activeId,
  onNavigate,
}: {
  activeId: AppTabId;
  onNavigate: (id: AppTabId) => void;
}) {
  const { meta, live, done, error, stopping, stopRun } = useAnalysisRun();

  if (!meta || error) return null;

  const tabId = KIND_TAB[meta.kind];
  // Hide when the user is already on the destination screen (running or ready).
  if (activeId === tabId) return null;

  const ready = done && !live;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-4 py-2",
      )}
    >
      <p className="min-w-0 flex-1 truncate text-sm text-foreground">
        {ready ? (
          <span className="font-medium">{friendlyKindReady(meta.kind)}</span>
        ) : (
          <span className="animate-thinking font-medium">
            {friendlyKindVerb(meta.kind)}…
          </span>
        )}
      </p>
      {ready ? (
        <Button
          type="button"
          size="sm"
          className="rounded-none"
          onClick={() => onNavigate(tabId)}
        >
          {friendlyKindViewLabel(meta.kind)}
        </Button>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none"
            onClick={() => onNavigate(tabId)}
          >
            View
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none"
            disabled={stopping}
            onClick={() => void stopRun()}
          >
            <Square className="size-3 fill-current" />
            {stopping ? "Stopping…" : "Stop"}
          </Button>
        </>
      )}
    </div>
  );
}
