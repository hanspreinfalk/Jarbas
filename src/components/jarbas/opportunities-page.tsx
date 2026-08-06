import { useMemo, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AppBadgeList } from "@/components/jarbas/app-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  MOCK_OPPORTUNITIES,
  type Opportunity,
} from "@/lib/mock-opportunities";
import { cn } from "@/lib/utils";

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? 6 : day - 1;
  next.setDate(next.getDate() - diff);
  return next;
}

type RangePreset = {
  id: string;
  label: string;
  getRange: () => { start: Date; end: Date };
};

const PRESETS: RangePreset[] = [
  {
    id: "today",
    label: "Today",
    getRange: () => {
      const today = new Date();
      return { start: startOfDay(today), end: endOfDay(today) };
    },
  },
  {
    id: "yesterday",
    label: "Yesterday",
    getRange: () => {
      const day = new Date();
      day.setDate(day.getDate() - 1);
      return { start: startOfDay(day), end: endOfDay(day) };
    },
  },
  {
    id: "yesterday-today",
    label: "Yesterday + today",
    getRange: () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: startOfDay(yesterday), end: endOfDay(today) };
    },
  },
  {
    id: "last-7",
    label: "Last 7 days",
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return { start: startOfDay(start), end: endOfDay(end) };
    },
  },
  {
    id: "last-week",
    label: "Last week",
    getRange: () => {
      const thisWeekStart = startOfWeek(new Date());
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
      const lastWeekStart = startOfWeek(lastWeekEnd);
      return { start: lastWeekStart, end: endOfDay(lastWeekEnd) };
    },
  },
  {
    id: "this-month",
    label: "This month",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    },
  },
];

function formatRangeLabel(start: string, end: string) {
  if (!start || !end) return "Choose a range";
  if (start === end) return start;
  return `${start} → ${end}`;
}

function OpportunityDetail({
  opportunity,
  onBack,
}: {
  opportunity: Opportunity;
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
        All opportunities
      </Button>

      <header className="mt-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-caps border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {opportunity.category}
          </span>
          <span className="text-xs text-muted-foreground">
            {opportunity.horizon}
          </span>
          <span className="text-xs text-muted-foreground">
            Impact {opportunity.impact}
          </span>
          <span className="text-xs text-muted-foreground">
            Effort {opportunity.effort}
          </span>
        </div>
        <h1 className="mt-3 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
          {opportunity.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Owner {opportunity.owner} · Saves {opportunity.hoursSavedPerCycle}
        </p>
      </header>

      <section className="mt-8 space-y-3">
        <h2 className="label-caps text-muted-foreground">Signal</h2>
        <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
          {opportunity.signal}
        </p>
      </section>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Unlock</h2>
        <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
          {opportunity.unlock}
        </p>
      </section>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Why now</h2>
        <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
          {opportunity.whyNow}
        </p>
      </section>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Delivery plan</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
          {opportunity.deliveryPlan.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="mt-8 grid gap-6 border-t border-border pt-8 sm:grid-cols-2">
        <div className="space-y-2">
          <h2 className="label-caps text-muted-foreground">Success metric</h2>
          <p className="text-sm leading-relaxed text-foreground">
            {opportunity.successMetric}
          </p>
        </div>
        <div className="space-y-2">
          <h2 className="label-caps text-muted-foreground">Related learning</h2>
          <p className="text-sm leading-relaxed text-foreground">
            {opportunity.relatedLearning}
          </p>
        </div>
      </section>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Prerequisites</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-foreground">
          {opportunity.prerequisites.map((item) => (
            <li key={item} className="border border-border bg-card px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Risks</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-foreground">
          {opportunity.risks.map((item) => (
            <li key={item} className="border border-border bg-card px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Apps</h2>
        <AppBadgeList apps={opportunity.apps} />
      </section>
    </div>
  );
}

export function OpportunitiesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [presetId, setPresetId] = useState<string | "custom">("today");
  const [startDate, setStartDate] = useState(() => toInputDate(new Date()));
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const selected = MOCK_OPPORTUNITIES.find(
    (opportunity) => opportunity.id === selectedId,
  );

  const rangeValid = useMemo(() => {
    if (!startDate || !endDate) return false;
    return startDate <= endDate;
  }, [startDate, endDate]);

  function applyPreset(preset: RangePreset) {
    const { start, end } = preset.getRange();
    setPresetId(preset.id);
    setStartDate(toInputDate(start));
    setEndDate(toInputDate(end));
  }

  function openCapture() {
    applyPreset(PRESETS[0]);
    setStatus(null);
    setOpen(true);
  }

  async function captureOpportunities() {
    if (!rangeValid) return;
    setCapturing(true);
    setStatus(null);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    setCapturing(false);
    setStatus(
      `Captured opportunities for ${formatRangeLabel(startDate, endDate)}.`,
    );
  }

  if (selected) {
    return (
      <OpportunityDetail
        opportunity={selected}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="label-caps text-muted-foreground">Jarbas</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            Opportunities
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Fast delivery unlocks ready to review.
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 rounded-none"
          onClick={openCapture}
        >
          <Sparkles className="size-3.5" />
          Capture opportunities
        </Button>
      </div>

      <ul className="mt-10 divide-y divide-border border border-border bg-card">
        {MOCK_OPPORTUNITIES.map((opportunity, index) => (
          <li key={opportunity.id}>
            <button
              type="button"
              onClick={() => setSelectedId(opportunity.id)}
              className="animate-rise w-full px-4 py-4 text-left transition-colors hover:bg-muted sm:px-5"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="label-caps border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {opportunity.category}
                </span>
                <span className="text-xs text-muted-foreground">
                  {opportunity.horizon}
                </span>
                <span className="text-xs text-muted-foreground">
                  Impact {opportunity.impact}
                </span>
                <span className="text-xs text-muted-foreground">
                  Effort {opportunity.effort}
                </span>
              </div>
              <h2 className="mt-2 text-sm font-semibold tracking-tight text-foreground sm:text-base">
                {opportunity.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Signal · </span>
                {opportunity.signal}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                <span className="font-medium">Unlock · </span>
                {opportunity.unlock}
              </p>
              <AppBadgeList apps={opportunity.apps} className="mt-3" />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Capture opportunities</DialogTitle>
            <DialogDescription>
              Choose a timeframe from suggestions or set custom dates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <p className="label-caps text-muted-foreground">Suggestions</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      "border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      presetId === preset.id
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="label-caps text-muted-foreground">Custom range</p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Start</span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      setPresetId("custom");
                      setStartDate(event.target.value);
                    }}
                    className="rounded-none"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">End</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(event) => {
                      setPresetId("custom");
                      setEndDate(event.target.value);
                    }}
                    className="rounded-none"
                  />
                </label>
              </div>
              {!rangeValid ? (
                <p className="mt-2 text-xs text-destructive">
                  End date must be on or after start date.
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Selected · {formatRangeLabel(startDate, endDate)}
                </p>
              )}
            </div>

            {status ? (
              <p className="border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                {status}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              className="rounded-none"
              disabled={!rangeValid || capturing}
              onClick={() => void captureOpportunities()}
            >
              <Sparkles className="size-3.5" />
              {capturing ? "Capturing…" : "Capture opportunities"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
