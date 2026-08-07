import { Square } from "lucide-react";
import { useAnalysisRun } from "@/components/jarbas/analysis-run-provider";
import { Button } from "@/components/ui/button";
import type { AppTabId } from "@/lib/app-tabs";
import { friendlyKindVerb } from "@/lib/friendly-analysis";
import { cn } from "@/lib/utils";

const KIND_TAB: Record<"learnings" | "opportunities" | "reports", AppTabId> = {
  learnings: "learnings",
  opportunities: "opportunities",
  reports: "reports",
};

export function AnalysisRunBanner({
  activeId,
  onNavigate,
}: {
  activeId: AppTabId;
  onNavigate: (id: AppTabId) => void;
}) {
  const { meta, live, stopping, stopRun } = useAnalysisRun();

  if (!live || !meta) return null;

  const tabId = KIND_TAB[meta.kind];
  if (activeId === tabId) return null;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-4 py-2",
      )}
    >
      <p className="min-w-0 flex-1 truncate text-sm text-foreground">
        <span className="animate-thinking font-medium">
          {friendlyKindVerb(meta.kind)}…
        </span>
        <span className="text-muted-foreground"> Still running in the background.</span>
      </p>
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
    </div>
  );
}
