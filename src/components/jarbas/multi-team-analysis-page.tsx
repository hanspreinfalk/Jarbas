import { useMemo, useState } from "react";
import { useAuth, useOrganization } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Network,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { AnalysisRunView } from "@/components/jarbas/analysis-run-view";
import { useAnalysisRun } from "@/components/jarbas/analysis-run-provider";
import { ReportDetailView } from "@/components/jarbas/reports-page";
import { TeamReportDetail } from "@/components/jarbas/team-report-detail";
import {
  GenerateTeamReportDialog,
  type GenerateTeamReportValues,
  type TeamReportPerson,
} from "@/components/jarbas/generate-team-report-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@convex/_generated/api";
import { startAnalysis } from "@/lib/analysis";
import { reportOverlapsDateRange } from "@/lib/report-range";
import { normalizeWorkReport, type WorkReport } from "@/lib/reports";
import {
  isTeamWorkReport,
  normalizeTeamWorkReport,
  type TeamWorkReport,
} from "@/lib/team-reports";
import { cn } from "@/lib/utils";

type MemberRow = {
  userId: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
  role: string;
};

function roleLabel(role: string): string {
  if (role === "org:admin") return "Admin";
  if (role === "org:member") return "Member";
  return role.replace(/^org:/, "").replace(/_/g, " ");
}

type View =
  | { kind: "home" }
  | { kind: "member"; userId: string; name: string }
  | {
      kind: "report";
      report: WorkReport | TeamWorkReport;
      back: View;
    };

export function MultiTeamAnalysisPage() {
  const { orgId } = useAuth();
  const { memberships, isLoaded: orgLoaded } = useOrganization({
    memberships: { infinite: true },
  });
  const orgReports = useQuery(
    api.reports.listForOrganization,
    orgId ? { organizationId: orgId } : "skip",
  );
  const createReport = useMutation(api.reports.create);
  const { meta, startRun, clearRun } = useAnalysisRun();

  const [view, setView] = useState<View>({ kind: "home" });
  const [starting, setStarting] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [pendingMemberIds, setPendingMemberIds] = useState<string[]>([]);

  const members: MemberRow[] = useMemo(() => {
    const rows = memberships?.data ?? [];
    return rows.map((membership) => {
      const user = membership.publicUserData;
      const name =
        [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
        user?.identifier ||
        "Member";
      return {
        userId: user?.userId ?? membership.id,
        name,
        email: user?.identifier ?? null,
        imageUrl: user?.imageUrl ?? null,
        role: membership.role,
      };
    });
  }, [memberships?.data]);

  const reports = useMemo(() => {
    return (orgReports ?? []).map((row) => {
      const raw = row as unknown as Record<string, unknown>;
      if (isTeamWorkReport(raw)) {
        return normalizeTeamWorkReport(raw);
      }
      return normalizeWorkReport(raw as unknown as WorkReport);
    });
  }, [orgReports]);

  const reportsByUser = useMemo(() => {
    const map = new Map<string, WorkReport[]>();
    for (const report of reports) {
      if (isTeamWorkReport(report)) continue;
      const meta = (
        report as WorkReport & {
          _convex?: { clerkUserId?: string; scope?: string };
        }
      )._convex;
      if (meta?.scope === "team") continue;
      const userId = meta?.clerkUserId;
      if (!userId) continue;
      const list = map.get(userId) ?? [];
      list.push(report);
      map.set(userId, list);
    }
    return map;
  }, [reports]);

  const teamReports = useMemo(
    () => reports.filter((report) => isTeamWorkReport(report)),
    [reports],
  );

  const filteredMembers = useMemo(() => {
    const q = peopleQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => {
      const haystack = [member.name, member.email, roleLabel(member.role)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [members, peopleQuery]);

  const dialogPeople: TeamReportPerson[] = useMemo(
    () =>
      members.map((member) => ({
        userId: member.userId,
        name: member.name,
        email: member.email,
        imageUrl: member.imageUrl,
        reportCount: reportsByUser.get(member.userId)?.length ?? 0,
      })),
    [members, reportsByUser],
  );

  async function handleGenerateTeamReport(values: GenerateTeamReportValues) {
    if (!orgId || starting) return;
    setStarting(true);
    setError(null);
    try {
      const selected = new Set(values.clerkUserIds);
      const labelByUser = new Map(
        values.memberLabels.map((row) => [row.clerkUserId, row.name]),
      );

      const memberPayloads: unknown[] = [];
      for (const userId of selected) {
        const list = reportsByUser.get(userId) ?? [];
        const inRange = list.filter((report) =>
          reportOverlapsDateRange(report, values.startDate, values.endDate),
        );
        for (const report of inRange) {
          memberPayloads.push({
            ...report,
            person: labelByUser.get(userId) || report.person || "Teammate",
            clerkUserId: userId,
          });
        }
      }

      if (memberPayloads.length === 0) {
        throw new Error(
          "No member reports in that timeframe for the selected people.",
        );
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const result = await startAnalysis({
        kind: "team-reports",
        startDate: values.startDate,
        endDate: values.endDate,
        provider: values.provider,
        model: values.model,
        memberReports: memberPayloads,
      });

      setPendingMemberIds(values.clerkUserIds);
      setGenerateOpen(false);
      startRun({
        jobId: result.jobId,
        kind: "team-reports",
        startDate: values.startDate,
        endDate: values.endDate,
        provider: result.provider,
        model: result.model,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  if (meta?.kind === "team-reports") {
    return (
      <AnalysisRunView
        onErrorBack={() => clearRun()}
        onCompleted={({ items }) => {
          void (async () => {
            try {
              setError(null);
              if (!orgId) {
                throw new Error("Select an organization before saving a team report.");
              }
              const payload = items?.[0];
              if (!payload || typeof payload !== "object") {
                throw new Error(
                  "Analysis finished but no team report payload was returned.",
                );
              }
              const saved = await createReport({
                organizationId: orgId,
                scope: "team",
                payload: {
                  ...(payload as Record<string, unknown>),
                  scope: "team",
                  selectedClerkUserIds: pendingMemberIds,
                },
              });
              clearRun();
              setPendingMemberIds([]);
              setView({
                kind: "report",
                report: normalizeTeamWorkReport(
                  saved as unknown as Record<string, unknown>,
                ),
                back: { kind: "home" },
              });
            } catch (err) {
              console.error("Failed to save team report", err);
              setError(err instanceof Error ? err.message : String(err));
              clearRun();
            }
          })();
        }}
      />
    );
  }

  if (view.kind === "report") {
    const backTo = view.back;
    if (isTeamWorkReport(view.report)) {
      return (
        <TeamReportDetail
          report={view.report}
          backLabel="Back"
          onBack={() => setView(backTo)}
          onSaved={(next) => {
            setView({ kind: "report", report: next, back: backTo });
          }}
          onDeleted={() => {
            setView(backTo.kind === "member" ? { kind: "home" } : backTo);
          }}
        />
      );
    }

    return (
      <ReportDetailView
        report={view.report}
        readOnly
        backLabel="Back"
        onBack={() => setView(backTo)}
      />
    );
  }

  if (view.kind === "member") {
    const list = reportsByUser.get(view.userId) ?? [];
    return (
      <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setView({ kind: "home" })}
          className="-ml-2 rounded-none text-muted-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Team analysis
        </Button>
        <header className="mt-4">
          <p className="label-caps text-muted-foreground">Member</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            {view.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {list.length === 0
              ? "No shared reports yet."
              : `${list.length} report${list.length === 1 ? "" : "s"}`}
          </p>
        </header>

        {list.length === 0 ? (
          <div className="mt-10 border border-border bg-card px-5 py-10 text-center">
            <p className="font-display text-xl tracking-tight text-foreground">
              Waiting on a report
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              When {view.name.split(" ")[0]} generates a report, it will show up
              here for the team.
            </p>
          </div>
        ) : (
          <ul className="mt-10 divide-y divide-border border border-border bg-card">
            {list.map((report, index) => (
              <li key={report.id}>
                <button
                  type="button"
                  onClick={() =>
                    setView({
                      kind: "report",
                      report,
                      back: {
                        kind: "member",
                        userId: view.userId,
                        name: view.name,
                      },
                    })
                  }
                  className={cn(
                    "flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-muted sm:px-5",
                    "animate-rise",
                  )}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground">
                    <CalendarDays className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold tracking-tight text-foreground">
                      {report.title}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {report.period}
                      {report.generatedAt ? ` · ${report.generatedAt}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const loadingMembers = !orgLoaded || memberships?.isLoading;
  const loadingReports = Boolean(orgId) && orgReports === undefined;

  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="min-w-0">
        <p className="label-caps text-muted-foreground">Admin</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            Team analysis
          </h1>
          <Button
            type="button"
            className="shrink-0 rounded-none self-start sm:self-auto"
            disabled={!orgId || members.length === 0}
            onClick={() => {
              setError(null);
              setGenerateOpen(true);
            }}
          >
            <Sparkles className="size-3.5" />
            Generate team report
          </Button>
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Review teammate reports, then synthesize a team report from the ones
          you select.
        </p>
      </div>

      {!orgId ? (
        <p className="mt-8 border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          Select an organization to open team analysis.
        </p>
      ) : null}

      {error ? (
        <p className="mt-8 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loadingMembers || loadingReports ? (
        <div className="mt-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading team…
        </div>
      ) : (
        <>
          <section className="mt-10">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <h2 className="label-caps text-muted-foreground">People</h2>
            </div>
            {members.length === 0 ? (
              <div className="mt-4 border border-border bg-card px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No members in this organization yet.
                </p>
              </div>
            ) : (
              <>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={peopleQuery}
                    onChange={(event) => setPeopleQuery(event.target.value)}
                    placeholder="Search people..."
                    className="h-10 rounded-none border-border bg-card pl-9"
                  />
                </div>
                {filteredMembers.length === 0 ? (
                  <div className="mt-4 border border-border bg-card px-5 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No people match “{peopleQuery.trim()}”.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-4 divide-y divide-border border border-border bg-card">
                    {filteredMembers.map((member, index) => {
                      const count =
                        reportsByUser.get(member.userId)?.length ?? 0;
                      return (
                        <li key={member.userId}>
                          <button
                            type="button"
                            onClick={() =>
                              setView({
                                kind: "member",
                                userId: member.userId,
                                name: member.name,
                              })
                            }
                            className={cn(
                              "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted sm:px-5",
                              "animate-rise",
                            )}
                            style={{ animationDelay: `${index * 40}ms` }}
                          >
                            {member.imageUrl ? (
                              <img
                                src={member.imageUrl}
                                alt=""
                                className="size-9 shrink-0 border border-border object-cover"
                              />
                            ) : (
                              <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-background font-display text-sm text-muted-foreground">
                                {member.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold tracking-tight text-foreground">
                                  {member.name}
                                </span>
                                <span className="shrink-0 border border-border bg-muted px-1 py-0.5 text-[8px] font-medium leading-none tracking-wide text-muted-foreground uppercase">
                                  {roleLabel(member.role)}
                                </span>
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {count === 0
                                  ? "No report yet"
                                  : `${count} report${count === 1 ? "" : "s"}`}
                                {member.email ? ` · ${member.email}` : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </section>

          {teamReports.length > 0 ? (
            <section className="mt-12">
              <div className="flex items-center gap-2">
                <Network className="size-4 text-muted-foreground" />
                <h2 className="label-caps text-muted-foreground">
                  Team reports
                </h2>
              </div>
              <ul className="mt-4 divide-y divide-border border border-border bg-card">
                {teamReports.map((report, index) => (
                  <li key={report.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setView({
                          kind: "report",
                          report,
                          back: { kind: "home" },
                        })
                      }
                      className={cn(
                        "flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-muted sm:px-5",
                        "animate-rise",
                      )}
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground">
                        <Network className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold tracking-tight text-foreground">
                          {report.title}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {report.period}
                          {report.generatedAt ? ` · ${report.generatedAt}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <GenerateTeamReportDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        people={dialogPeople}
        submitting={starting}
        onConfirm={handleGenerateTeamReport}
      />
    </div>
  );
}
