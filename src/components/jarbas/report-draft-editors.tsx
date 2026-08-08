import { type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  FieldInput,
  FieldLabel,
  TextArea,
  listToLines,
  linesToList,
  listToCsv,
  csvToList,
} from "@/components/jarbas/analysis-item-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReportDraft } from "@/lib/report-draft";
import { cn } from "@/lib/utils";

function NumberInput({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <Input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      className={cn("rounded-none", className)}
    />
  );
}

function RowShell({
  children,
  onRemove,
}: {
  children: ReactNode;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 border border-border bg-card px-3 py-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-none text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
          Remove
        </Button>
      </div>
      {children}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-none"
      onClick={onClick}
    >
      <Plus className="size-3.5" />
      {label}
    </Button>
  );
}

export function ReportDraftEditors({
  draft,
  setDraft,
}: {
  draft: ReportDraft;
  setDraft: Dispatch<SetStateAction<ReportDraft>>;
}) {
  function patch<K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="label-caps text-muted-foreground">Header</p>
        <div className="space-y-1.5">
          <FieldLabel>Title</FieldLabel>
          <FieldInput
            value={draft.title}
            onChange={(value) => patch("title", value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel>Subtitle</FieldLabel>
            <FieldInput
              value={draft.subtitle}
              onChange={(value) => patch("subtitle", value)}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Period</FieldLabel>
            <FieldInput
              value={draft.period}
              onChange={(value) => patch("period", value)}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Person</FieldLabel>
            <FieldInput
              value={draft.person}
              onChange={(value) => patch("person", value)}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Role</FieldLabel>
            <FieldInput
              value={draft.role}
              onChange={(value) => patch("role", value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel>Generated</FieldLabel>
            <FieldInput
              value={draft.generatedAt}
              onChange={(value) => patch("generatedAt", value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Headline</FieldLabel>
          <TextArea
            value={draft.headline}
            onChange={(value) => patch("headline", value)}
            rows={3}
          />
        </div>
      </section>

      <section className="space-y-4">
        <p className="label-caps text-muted-foreground">01 · Explanation</p>
        <div className="space-y-1.5">
          <FieldLabel>Executive brief</FieldLabel>
          <TextArea
            value={draft.executiveBrief}
            onChange={(value) => patch("executiveBrief", value)}
            rows={5}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Key insight</FieldLabel>
          <TextArea
            value={draft.keyInsight}
            onChange={(value) => patch("keyInsight", value)}
            rows={3}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel>Delivery unlock</FieldLabel>
            <FieldInput
              value={draft.deliveryUnlock}
              onChange={(value) => patch("deliveryUnlock", value)}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Impact once</FieldLabel>
            <FieldInput
              value={draft.impactOnce}
              onChange={(value) => patch("impactOnce", value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="label-caps text-muted-foreground">02 · Week snapshot · KPIs</p>
          <AddButton
            label="Add KPI"
            onClick={() =>
              patch("kpis", [
                ...draft.kpis,
                { label: "", value: "", delta: "", tone: "flat" },
              ])
            }
          />
        </div>
        {draft.kpis.map((kpi, index) => (
          <RowShell
            key={`kpi-${index}`}
            onRemove={() =>
              patch(
                "kpis",
                draft.kpis.filter((_, i) => i !== index),
              )
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel>Label</FieldLabel>
                <FieldInput
                  value={kpi.label}
                  onChange={(value) =>
                    patch(
                      "kpis",
                      draft.kpis.map((row, i) =>
                        i === index ? { ...row, label: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Value</FieldLabel>
                <FieldInput
                  value={kpi.value}
                  onChange={(value) =>
                    patch(
                      "kpis",
                      draft.kpis.map((row, i) =>
                        i === index ? { ...row, value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Delta</FieldLabel>
                <FieldInput
                  value={kpi.delta}
                  onChange={(value) =>
                    patch(
                      "kpis",
                      draft.kpis.map((row, i) =>
                        i === index ? { ...row, delta: value } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
          </RowShell>
        ))}

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="label-caps text-muted-foreground">Findings</p>
          <AddButton
            label="Add finding"
            onClick={() =>
              patch("findings", [...draft.findings, { title: "", detail: "" }])
            }
          />
        </div>
        {draft.findings.map((finding, index) => (
          <RowShell
            key={`finding-${index}`}
            onRemove={() =>
              patch(
                "findings",
                draft.findings.filter((_, i) => i !== index),
              )
            }
          >
            <div className="space-y-1.5">
              <FieldLabel>Title</FieldLabel>
              <FieldInput
                value={finding.title}
                onChange={(value) =>
                  patch(
                    "findings",
                    draft.findings.map((row, i) =>
                      i === index ? { ...row, title: value } : row,
                    ),
                  )
                }
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Detail</FieldLabel>
              <TextArea
                value={finding.detail}
                onChange={(value) =>
                  patch(
                    "findings",
                    draft.findings.map((row, i) =>
                      i === index ? { ...row, detail: value } : row,
                    ),
                  )
                }
                rows={3}
              />
            </div>
          </RowShell>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="label-caps text-muted-foreground">03 · Where time went</p>
          <AddButton
            label="Add category"
            onClick={() =>
              patch("timeAllocation", [
                ...draft.timeAllocation,
                { name: "", hours: 0, fill: "#080870" },
              ])
            }
          />
        </div>
        {draft.timeAllocation.map((item, index) => (
          <RowShell
            key={`time-${index}`}
            onRemove={() =>
              patch(
                "timeAllocation",
                draft.timeAllocation.filter((_, i) => i !== index),
              )
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel>Name</FieldLabel>
                <FieldInput
                  value={item.name}
                  onChange={(value) =>
                    patch(
                      "timeAllocation",
                      draft.timeAllocation.map((row, i) =>
                        i === index ? { ...row, name: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Hours</FieldLabel>
                <NumberInput
                  value={item.hours}
                  onChange={(value) =>
                    patch(
                      "timeAllocation",
                      draft.timeAllocation.map((row, i) =>
                        i === index ? { ...row, hours: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Color</FieldLabel>
                <FieldInput
                  value={item.fill}
                  onChange={(value) =>
                    patch(
                      "timeAllocation",
                      draft.timeAllocation.map((row, i) =>
                        i === index ? { ...row, fill: value } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
          </RowShell>
        ))}
        <div className="space-y-1.5">
          <FieldLabel>Takeaway</FieldLabel>
          <TextArea
            value={draft.timeAllocationTakeaway}
            onChange={(value) => patch("timeAllocationTakeaway", value)}
            rows={2}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="label-caps text-muted-foreground">04 · Daily cadence</p>
          <AddButton
            label="Add day"
            onClick={() =>
              patch("dailyMix", [
                ...draft.dailyMix,
                { day: "", deepWork: 0, collaboration: 0, admin: 0 },
              ])
            }
          />
        </div>
        {draft.dailyMix.map((item, index) => (
          <RowShell
            key={`mix-${index}`}
            onRemove={() =>
              patch(
                "dailyMix",
                draft.dailyMix.filter((_, i) => i !== index),
              )
            }
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <FieldLabel>Day</FieldLabel>
                <FieldInput
                  value={item.day}
                  onChange={(value) =>
                    patch(
                      "dailyMix",
                      draft.dailyMix.map((row, i) =>
                        i === index ? { ...row, day: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Deep work (h)</FieldLabel>
                <NumberInput
                  value={item.deepWork}
                  onChange={(value) =>
                    patch(
                      "dailyMix",
                      draft.dailyMix.map((row, i) =>
                        i === index ? { ...row, deepWork: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Collab (h)</FieldLabel>
                <NumberInput
                  value={item.collaboration}
                  onChange={(value) =>
                    patch(
                      "dailyMix",
                      draft.dailyMix.map((row, i) =>
                        i === index ? { ...row, collaboration: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Admin (h)</FieldLabel>
                <NumberInput
                  value={item.admin}
                  onChange={(value) =>
                    patch(
                      "dailyMix",
                      draft.dailyMix.map((row, i) =>
                        i === index ? { ...row, admin: value } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
          </RowShell>
        ))}
        <div className="space-y-1.5">
          <FieldLabel>Daily mix takeaway</FieldLabel>
          <TextArea
            value={draft.dailyMixTakeaway}
            onChange={(value) => patch("dailyMixTakeaway", value)}
            rows={2}
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="label-caps text-muted-foreground">Focus index</p>
          <AddButton
            label="Add day"
            onClick={() =>
              patch("focusScore", [...draft.focusScore, { day: "", score: 0 }])
            }
          />
        </div>
        {draft.focusScore.map((item, index) => (
          <RowShell
            key={`focus-${index}`}
            onRemove={() =>
              patch(
                "focusScore",
                draft.focusScore.filter((_, i) => i !== index),
              )
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Day</FieldLabel>
                <FieldInput
                  value={item.day}
                  onChange={(value) =>
                    patch(
                      "focusScore",
                      draft.focusScore.map((row, i) =>
                        i === index ? { ...row, day: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Score</FieldLabel>
                <NumberInput
                  value={item.score}
                  onChange={(value) =>
                    patch(
                      "focusScore",
                      draft.focusScore.map((row, i) =>
                        i === index ? { ...row, score: value } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
          </RowShell>
        ))}
        <div className="space-y-1.5">
          <FieldLabel>Focus takeaway</FieldLabel>
          <TextArea
            value={draft.focusTakeaway}
            onChange={(value) => patch("focusTakeaway", value)}
            rows={2}
          />
        </div>
      </section>

      <section className="space-y-4">
        <p className="label-caps text-muted-foreground">05 · What they did</p>
        <div className="space-y-1.5">
          <FieldLabel>Items</FieldLabel>
          <TextArea
            value={listToLines(draft.whatTheyDid)}
            onChange={(value) => patch("whatTheyDid", linesToList(value))}
            rows={6}
          />
          <p className="text-xs text-muted-foreground">One item per line</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="label-caps text-muted-foreground">06 · Timeline</p>
          <AddButton
            label="Add entry"
            onClick={() =>
              patch("timeline", [
                ...draft.timeline,
                { time: "", activity: "", type: "deep" },
              ])
            }
          />
        </div>
        {draft.timeline.map((item, index) => (
          <RowShell
            key={`timeline-${index}`}
            onRemove={() =>
              patch(
                "timeline",
                draft.timeline.filter((_, i) => i !== index),
              )
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel>Time</FieldLabel>
                <FieldInput
                  value={item.time}
                  onChange={(value) =>
                    patch(
                      "timeline",
                      draft.timeline.map((row, i) =>
                        i === index ? { ...row, time: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel>Activity</FieldLabel>
                <FieldInput
                  value={item.activity}
                  onChange={(value) =>
                    patch(
                      "timeline",
                      draft.timeline.map((row, i) =>
                        i === index ? { ...row, activity: value } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
          </RowShell>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="label-caps text-muted-foreground">07 · Insights</p>
          <AddButton
            label="Add insight"
            onClick={() =>
              patch("learnings", [
                ...draft.learnings,
                { title: "", observed: "", insight: "", apps: [] },
              ])
            }
          />
        </div>
        {draft.learnings.map((item, index) => (
          <RowShell
            key={`learning-${index}`}
            onRemove={() =>
              patch(
                "learnings",
                draft.learnings.filter((_, i) => i !== index),
              )
            }
          >
            <div className="space-y-1.5">
              <FieldLabel>Title</FieldLabel>
              <FieldInput
                value={item.title}
                onChange={(value) =>
                  patch(
                    "learnings",
                    draft.learnings.map((row, i) =>
                      i === index ? { ...row, title: value } : row,
                    ),
                  )
                }
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Observed</FieldLabel>
              <TextArea
                value={item.observed}
                onChange={(value) =>
                  patch(
                    "learnings",
                    draft.learnings.map((row, i) =>
                      i === index ? { ...row, observed: value } : row,
                    ),
                  )
                }
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Insight</FieldLabel>
              <TextArea
                value={item.insight}
                onChange={(value) =>
                  patch(
                    "learnings",
                    draft.learnings.map((row, i) =>
                      i === index ? { ...row, insight: value } : row,
                    ),
                  )
                }
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Apps</FieldLabel>
              <FieldInput
                value={listToCsv(item.apps)}
                onChange={(value) =>
                  patch(
                    "learnings",
                    draft.learnings.map((row, i) =>
                      i === index ? { ...row, apps: csvToList(value) } : row,
                    ),
                  )
                }
              />
              <p className="text-xs text-muted-foreground">Comma-separated</p>
            </div>
          </RowShell>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="label-caps text-muted-foreground">08 · Opportunities</p>
          <AddButton
            label="Add opportunity"
            onClick={() =>
              patch("opportunities", [
                ...draft.opportunities,
                {
                  name: "",
                  unlock: "",
                  fromLearning: "",
                  impact: 0,
                  effort: 1,
                  horizon: "",
                  automationIdea: "",
                },
              ])
            }
          />
        </div>
        {draft.opportunities.map((item, index) => (
          <RowShell
            key={`opp-${index}`}
            onRemove={() =>
              patch(
                "opportunities",
                draft.opportunities.filter((_, i) => i !== index),
              )
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Name</FieldLabel>
                <FieldInput
                  value={item.name}
                  onChange={(value) =>
                    patch(
                      "opportunities",
                      draft.opportunities.map((row, i) =>
                        i === index ? { ...row, name: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Horizon</FieldLabel>
                <FieldInput
                  value={item.horizon}
                  onChange={(value) =>
                    patch(
                      "opportunities",
                      draft.opportunities.map((row, i) =>
                        i === index ? { ...row, horizon: value } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Unlock</FieldLabel>
              <TextArea
                value={item.unlock}
                onChange={(value) =>
                  patch(
                    "opportunities",
                    draft.opportunities.map((row, i) =>
                      i === index ? { ...row, unlock: value } : row,
                    ),
                  )
                }
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>From insight</FieldLabel>
              <TextArea
                value={item.fromLearning}
                onChange={(value) =>
                  patch(
                    "opportunities",
                    draft.opportunities.map((row, i) =>
                      i === index ? { ...row, fromLearning: value } : row,
                    ),
                  )
                }
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Automation idea</FieldLabel>
              <TextArea
                value={item.automationIdea ?? ""}
                onChange={(value) =>
                  patch(
                    "opportunities",
                    draft.opportunities.map((row, i) =>
                      i === index ? { ...row, automationIdea: value } : row,
                    ),
                  )
                }
                rows={2}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Impact</FieldLabel>
                <NumberInput
                  value={item.impact}
                  onChange={(value) =>
                    patch(
                      "opportunities",
                      draft.opportunities.map((row, i) =>
                        i === index ? { ...row, impact: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Effort</FieldLabel>
                <NumberInput
                  value={item.effort}
                  onChange={(value) =>
                    patch(
                      "opportunities",
                      draft.opportunities.map((row, i) =>
                        i === index ? { ...row, effort: value } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
          </RowShell>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="label-caps text-muted-foreground">09 · Repetitive work</p>
          <AddButton
            label="Add item"
            onClick={() =>
              patch("repetitiveWork", [
                ...draft.repetitiveWork,
                {
                  activity: "",
                  occurrences: 0,
                  minutesEach: 0,
                  automatable: false,
                },
              ])
            }
          />
        </div>
        {draft.repetitiveWork.map((item, index) => (
          <RowShell
            key={`rep-${index}`}
            onRemove={() =>
              patch(
                "repetitiveWork",
                draft.repetitiveWork.filter((_, i) => i !== index),
              )
            }
          >
            <div className="space-y-1.5">
              <FieldLabel>Activity</FieldLabel>
              <FieldInput
                value={item.activity}
                onChange={(value) =>
                  patch(
                    "repetitiveWork",
                    draft.repetitiveWork.map((row, i) =>
                      i === index ? { ...row, activity: value } : row,
                    ),
                  )
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel>Occurrences</FieldLabel>
                <NumberInput
                  value={item.occurrences}
                  onChange={(value) =>
                    patch(
                      "repetitiveWork",
                      draft.repetitiveWork.map((row, i) =>
                        i === index ? { ...row, occurrences: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Minutes each</FieldLabel>
                <NumberInput
                  value={item.minutesEach}
                  onChange={(value) =>
                    patch(
                      "repetitiveWork",
                      draft.repetitiveWork.map((row, i) =>
                        i === index ? { ...row, minutesEach: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={item.automatable}
                  onChange={(event) =>
                    patch(
                      "repetitiveWork",
                      draft.repetitiveWork.map((row, i) =>
                        i === index
                          ? { ...row, automatable: event.target.checked }
                          : row,
                      ),
                    )
                  }
                />
                Automatable
              </label>
            </div>
          </RowShell>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="label-caps text-muted-foreground">10 · Bottlenecks</p>
          <AddButton
            label="Add bottleneck"
            onClick={() =>
              patch("bottlenecks", [
                ...draft.bottlenecks,
                { title: "", cost: "", unlock: "" },
              ])
            }
          />
        </div>
        {draft.bottlenecks.map((item, index) => (
          <RowShell
            key={`bn-${index}`}
            onRemove={() =>
              patch(
                "bottlenecks",
                draft.bottlenecks.filter((_, i) => i !== index),
              )
            }
          >
            <div className="space-y-1.5">
              <FieldLabel>Title</FieldLabel>
              <FieldInput
                value={item.title}
                onChange={(value) =>
                  patch(
                    "bottlenecks",
                    draft.bottlenecks.map((row, i) =>
                      i === index ? { ...row, title: value } : row,
                    ),
                  )
                }
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Cost</FieldLabel>
              <TextArea
                value={item.cost}
                onChange={(value) =>
                  patch(
                    "bottlenecks",
                    draft.bottlenecks.map((row, i) =>
                      i === index ? { ...row, cost: value } : row,
                    ),
                  )
                }
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Unlock</FieldLabel>
              <TextArea
                value={item.unlock}
                onChange={(value) =>
                  patch(
                    "bottlenecks",
                    draft.bottlenecks.map((row, i) =>
                      i === index ? { ...row, unlock: value } : row,
                    ),
                  )
                }
                rows={2}
              />
            </div>
          </RowShell>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="label-caps text-muted-foreground">11 · Scorecard</p>
          <AddButton
            label="Add score"
            onClick={() =>
              patch("scorecard", [
                ...draft.scorecard,
                { label: "", score: 0, note: "" },
              ])
            }
          />
        </div>
        {draft.scorecard.map((item, index) => (
          <RowShell
            key={`score-${index}`}
            onRemove={() =>
              patch(
                "scorecard",
                draft.scorecard.filter((_, i) => i !== index),
              )
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Label</FieldLabel>
                <FieldInput
                  value={item.label}
                  onChange={(value) =>
                    patch(
                      "scorecard",
                      draft.scorecard.map((row, i) =>
                        i === index ? { ...row, label: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Score</FieldLabel>
                <NumberInput
                  value={item.score}
                  onChange={(value) =>
                    patch(
                      "scorecard",
                      draft.scorecard.map((row, i) =>
                        i === index ? { ...row, score: value } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Note</FieldLabel>
              <TextArea
                value={item.note}
                onChange={(value) =>
                  patch(
                    "scorecard",
                    draft.scorecard.map((row, i) =>
                      i === index ? { ...row, note: value } : row,
                    ),
                  )
                }
                rows={2}
              />
            </div>
          </RowShell>
        ))}
        <div className="space-y-1.5 pt-2">
          <FieldLabel>Improvements</FieldLabel>
          <TextArea
            value={listToLines(draft.improvements)}
            onChange={(value) => patch("improvements", linesToList(value))}
            rows={5}
          />
          <p className="text-xs text-muted-foreground">One item per line</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="label-caps text-muted-foreground">12 · Next steps</p>
          <AddButton
            label="Add step"
            onClick={() =>
              patch("nextSteps", [
                ...draft.nextSteps,
                { action: "", owner: "", when: "" },
              ])
            }
          />
        </div>
        {draft.nextSteps.map((item, index) => (
          <RowShell
            key={`step-${index}`}
            onRemove={() =>
              patch(
                "nextSteps",
                draft.nextSteps.filter((_, i) => i !== index),
              )
            }
          >
            <div className="space-y-1.5">
              <FieldLabel>Action</FieldLabel>
              <FieldInput
                value={item.action}
                onChange={(value) =>
                  patch(
                    "nextSteps",
                    draft.nextSteps.map((row, i) =>
                      i === index ? { ...row, action: value } : row,
                    ),
                  )
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Owner</FieldLabel>
                <FieldInput
                  value={item.owner}
                  onChange={(value) =>
                    patch(
                      "nextSteps",
                      draft.nextSteps.map((row, i) =>
                        i === index ? { ...row, owner: value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>When</FieldLabel>
                <FieldInput
                  value={item.when}
                  onChange={(value) =>
                    patch(
                      "nextSteps",
                      draft.nextSteps.map((row, i) =>
                        i === index ? { ...row, when: value } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
          </RowShell>
        ))}
      </section>
    </div>
  );
}
