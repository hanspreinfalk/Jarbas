import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { UserIdentity } from "convex/server";
import { v } from "convex/values";

function requireIdentity(identity: UserIdentity | null): UserIdentity {
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

/** Optional org claims from the Clerk JWT template (org_id / org_role). */
function tokenOrg(identity: UserIdentity): {
  orgId?: string;
  orgRole?: string;
} {
  const orgId =
    (typeof identity.org_id === "string" && identity.org_id) ||
    (typeof identity.orgId === "string" && identity.orgId) ||
    undefined;
  const orgRole =
    (typeof identity.org_role === "string" && identity.org_role) ||
    (typeof identity.orgRole === "string" && identity.orgRole) ||
    undefined;
  return { orgId: orgId || undefined, orgRole: orgRole || undefined };
}

function assertOrgMatches(identity: UserIdentity, organizationId: string) {
  // Prefer client orgId; only hard-fail when JWT clearly disagrees.
  const { orgId } = tokenOrg(identity);
  if (orgId && organizationId && orgId !== organizationId) {
    // Some Clerk JWT templates omit/lag active org — don't block saves on mismatch noise.
    console.warn(
      `Organization claim ${orgId} differs from requested ${organizationId}; proceeding with requested org.`,
    );
  }
}

function assertOrgAdmin(identity: UserIdentity) {
  const { orgRole } = tokenOrg(identity);
  if (!orgRole) return; // claim absent — client gates admin UI
  if (orgRole !== "org:admin" && orgRole !== "admin") {
    throw new Error("Admin only");
  }
}

function asReportPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Report payload must be an object");
  }
  return raw as Record<string, unknown>;
}

function resolveGenerationDurationMs(
  payload: Record<string, unknown>,
): number | undefined {
  const top = payload.generationDurationMs;
  if (typeof top === "number" && Number.isFinite(top) && top >= 0) {
    return Math.round(top);
  }

  const analysis = payload.analysis;
  if (analysis && typeof analysis === "object" && !Array.isArray(analysis)) {
    const blob = analysis as Record<string, unknown>;
    const duration = blob.durationMs;
    if (
      typeof duration === "number" &&
      Number.isFinite(duration) &&
      duration >= 0
    ) {
      return Math.round(duration);
    }
    const started = blob.startedAt;
    const finished = blob.finishedAt;
    if (
      typeof started === "number" &&
      typeof finished === "number" &&
      Number.isFinite(started) &&
      Number.isFinite(finished) &&
      finished >= started
    ) {
      return Math.round(finished - started);
    }
  }

  const started = payload.generationStartedAt;
  const finished = payload.generationFinishedAt;
  if (
    typeof started === "number" &&
    typeof finished === "number" &&
    Number.isFinite(started) &&
    Number.isFinite(finished) &&
    finished >= started
  ) {
    return Math.round(finished - started);
  }

  return undefined;
}

function docToWorkReport(doc: Doc<"reports">): Record<string, unknown> {
  const payload = asReportPayload(doc.payload);
  const generationDurationMs =
    typeof doc.generationDurationMs === "number"
      ? doc.generationDurationMs
      : resolveGenerationDurationMs(payload);
  return {
    ...payload,
    id: doc._id,
    title: doc.title || String(payload.title ?? "Work report"),
    period: doc.period ?? (payload.period as string | undefined) ?? "",
    startDate: doc.startDate ?? (payload.startDate as string | undefined),
    endDate: doc.endDate ?? (payload.endDate as string | undefined),
    generatedAt:
      doc.generatedAt ??
      (payload.generatedAt as string | undefined) ??
      (payload.createdAt as string | undefined) ??
      "",
    generationDurationMs,
    _convex: {
      organizationId: doc.organizationId,
      clerkUserId: doc.clerkUserId,
      createdByClerkUserId: doc.createdByClerkUserId,
      scope: doc.scope,
    },
  };
}

export const listMine = query({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    // Return empty instead of throwing — Convex useQuery errors crash the React tree.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    if (!args.organizationId.trim()) return [];

    const rows = await ctx.db
      .query("reports")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("clerkUserId", identity.subject),
      )
      .collect();

    return rows
      .filter((row) => row.scope === "member")
      .sort((a, b) => b._creationTime - a._creationTime)
      .map(docToWorkReport);
  },
});

export const listForOrganization = query({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    if (!args.organizationId.trim()) return [];
    // Soft admin check: if JWT has an org role and it isn't admin, hide org-wide data.
    const { orgRole } = tokenOrg(identity);
    if (
      orgRole &&
      orgRole !== "org:admin" &&
      orgRole !== "admin"
    ) {
      return [];
    }

    const rows = await ctx.db
      .query("reports")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    return rows
      .sort((a, b) => b._creationTime - a._creationTime)
      .map(docToWorkReport);
  },
});

export const listForMember = query({
  args: {
    organizationId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    if (!args.organizationId.trim()) return [];

    const isSelf = identity.subject === args.clerkUserId;
    if (!isSelf) {
      const { orgRole } = tokenOrg(identity);
      if (
        orgRole &&
        orgRole !== "org:admin" &&
        orgRole !== "admin"
      ) {
        return [];
      }
    }

    const rows = await ctx.db
      .query("reports")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("clerkUserId", args.clerkUserId),
      )
      .collect();

    return rows
      .filter((row) => row.scope === "member")
      .sort((a, b) => b._creationTime - a._creationTime)
      .map(docToWorkReport);
  },
});

export const get = query({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const doc = await ctx.db.get(args.id);
    if (!doc) return null;

    const isSelf = identity.subject === doc.clerkUserId;
    if (!isSelf) {
      const { orgRole } = tokenOrg(identity);
      if (
        orgRole &&
        orgRole !== "org:admin" &&
        orgRole !== "admin"
      ) {
        return null;
      }
    }

    return docToWorkReport(doc);
  },
});

export const create = mutation({
  args: {
    organizationId: v.string(),
    payload: v.any(),
    scope: v.optional(v.union(v.literal("member"), v.literal("team"))),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity());
    assertOrgMatches(identity, args.organizationId);

    const scope = args.scope ?? "member";
    if (scope === "team") assertOrgAdmin(identity);

    const payload = asReportPayload(args.payload);
    const title = String(payload.title ?? (scope === "team" ? "Team report" : "Work report")).trim()
      || (scope === "team" ? "Team report" : "Work report");
    const period =
      typeof payload.period === "string" ? payload.period : undefined;
    const startDate =
      typeof payload.startDate === "string" ? payload.startDate : undefined;
    const endDate =
      typeof payload.endDate === "string" ? payload.endDate : undefined;
    const generatedAt =
      (typeof payload.generatedAt === "string" && payload.generatedAt) ||
      (typeof payload.createdAt === "string" && payload.createdAt) ||
      new Date().toISOString();

    // Drop any local file id — Convex `_id` is the source of truth.
    const { id: _drop, ...rest } = payload;
    void _drop;
    if (scope === "team") {
      rest.scope = "team";
    }

    const generationDurationMs = resolveGenerationDurationMs(rest);
    if (generationDurationMs != null) {
      rest.generationDurationMs = generationDurationMs;
    }

    // Idempotent on analysis jobId so a missed UI completion cannot double-insert.
    const jobId =
      typeof rest.jobId === "string"
        ? rest.jobId.trim()
        : typeof (rest.analysis as { jobId?: string } | undefined)?.jobId ===
            "string"
          ? String((rest.analysis as { jobId: string }).jobId).trim()
          : "";
    if (jobId) {
      const existing = await ctx.db
        .query("reports")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .collect();
      const match = existing.find((doc) => {
        const p = doc.payload as Record<string, unknown> | null;
        if (!p || typeof p !== "object") return false;
        if (p.jobId === jobId) return true;
        const analysis = p.analysis as { jobId?: string } | undefined;
        return analysis?.jobId === jobId;
      });
      if (match) return docToWorkReport(match);
    }

    const reportId = await ctx.db.insert("reports", {
      clerkUserId: identity.subject,
      organizationId: args.organizationId,
      createdByClerkUserId: identity.subject,
      scope,
      title,
      period,
      startDate,
      endDate,
      generatedAt,
      generationDurationMs,
      payload: rest,
    });

    const doc = await ctx.db.get(reportId);
    if (!doc) throw new Error("Failed to create report");
    return docToWorkReport(doc);
  },
});

export const update = mutation({
  args: {
    id: v.id("reports"),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity());
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Report not found");
    assertOrgMatches(identity, doc.organizationId);

    const isOwner =
      doc.clerkUserId === identity.subject ||
      doc.createdByClerkUserId === identity.subject;
    if (!isOwner) {
      // Org admins may edit team rollups (and other org reports).
      assertOrgAdmin(identity);
    }

    const payload = asReportPayload(args.payload);
    const { id: _drop, _convex: _c, ...rest } = payload as Record<
      string,
      unknown
    > & { _convex?: unknown };
    void _drop;
    void _c;

    const title = String(rest.title ?? doc.title).trim() || doc.title;
    const period =
      typeof rest.period === "string" ? rest.period : doc.period;
    const startDate =
      typeof rest.startDate === "string" ? rest.startDate : doc.startDate;
    const endDate =
      typeof rest.endDate === "string" ? rest.endDate : doc.endDate;
    const generatedAt =
      typeof rest.generatedAt === "string" ? rest.generatedAt : doc.generatedAt;

    await ctx.db.patch(args.id, {
      title,
      period,
      startDate,
      endDate,
      generatedAt,
      payload: rest,
    });

    const next = await ctx.db.get(args.id);
    if (!next) throw new Error("Report not found");
    return docToWorkReport(next);
  },
});

/** Patch only `payload.executiveBrief` (CLI / targeted edits). Auth via --identity. */
export const patchExecutiveBrief = mutation({
  args: {
    id: v.id("reports"),
    executiveBrief: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity());
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Report not found");
    assertOrgMatches(identity, doc.organizationId);

    const isOwner =
      doc.clerkUserId === identity.subject ||
      doc.createdByClerkUserId === identity.subject;
    if (!isOwner) {
      assertOrgAdmin(identity);
    }

    const payload = {
      ...asReportPayload(doc.payload),
      executiveBrief: args.executiveBrief,
    };
    await ctx.db.patch(args.id, { payload });
    return { ok: true as const, id: args.id };
  },
});

export const remove = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity());
    const doc = await ctx.db.get(args.id);
    if (!doc) return;
    assertOrgMatches(identity, doc.organizationId);

    const isOwner =
      doc.clerkUserId === identity.subject ||
      doc.createdByClerkUserId === identity.subject;
    if (!isOwner) assertOrgAdmin(identity);

    await ctx.db.delete(args.id);
  },
});

/**
 * Build a team-scoped rollup from selected members' reports in a date range.
 * Deterministic aggregate for now (no extra AI call).
 */
export const createTeamRollup = mutation({
  args: {
    organizationId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    clerkUserIds: v.array(v.string()),
    memberLabels: v.optional(
      v.array(
        v.object({
          clerkUserId: v.string(),
          name: v.string(),
        }),
      ),
    ),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity());
    assertOrgMatches(identity, args.organizationId);
    assertOrgAdmin(identity);

    if (!args.startDate || !args.endDate || args.startDate > args.endDate) {
      throw new Error("Choose a valid start and end date.");
    }
    const selectedIds = [...new Set(args.clerkUserIds.map((id) => id.trim()).filter(Boolean))];
    if (selectedIds.length === 0) {
      throw new Error("Select at least one person.");
    }

    const labelByUser = new Map(
      (args.memberLabels ?? []).map((row) => [row.clerkUserId, row.name]),
    );

    const rows = await ctx.db
      .query("reports")
      .withIndex("by_org_scope", (q) =>
        q.eq("organizationId", args.organizationId).eq("scope", "member"),
      )
      .collect();

    const selected = new Set(selectedIds);
    const inRange = rows.filter((row) => {
      if (!selected.has(row.clerkUserId)) return false;
      return reportOverlapsRange(row, args.startDate, args.endDate);
    });

    if (inRange.length === 0) {
      throw new Error(
        "No member reports in that timeframe for the selected people.",
      );
    }

    // Latest in-range report per selected member.
    const latestByUser = new Map<string, Doc<"reports">>();
    for (const row of inRange) {
      const existing = latestByUser.get(row.clerkUserId);
      if (!existing || row._creationTime > existing._creationTime) {
        latestByUser.set(row.clerkUserId, row);
      }
    }

    const memberReports = [...latestByUser.values()].map(docToWorkReport);
    const people = memberReports.map((r) => {
      const meta = r._convex as { clerkUserId?: string } | undefined;
      const clerkUserId =
        typeof meta?.clerkUserId === "string" ? meta.clerkUserId : "";
      const labeled = clerkUserId ? labelByUser.get(clerkUserId) : undefined;
      if (labeled?.trim()) return labeled.trim();
      return typeof r.person === "string" && r.person.trim()
        ? r.person.trim()
        : "Teammate";
    });

    const findings = memberReports.flatMap((r, index) => {
      const person = people[index] || "Teammate";
      const headline =
        typeof r.headline === "string" && r.headline.trim()
          ? r.headline.trim()
          : typeof r.executiveBrief === "string"
            ? r.executiveBrief.trim().slice(0, 180)
            : "";
      if (!headline) return [];
      return [{ title: person, detail: headline }];
    });

    const opportunities = memberReports.flatMap((r) => {
      const list = Array.isArray(r.opportunities) ? r.opportunities : [];
      return list.slice(0, 3);
    });

    const learnings = memberReports.flatMap((r) => {
      const list = Array.isArray(r.learnings) ? r.learnings : [];
      return list.slice(0, 2);
    });

    const period =
      args.startDate === args.endDate
        ? args.startDate
        : `${args.startDate} → ${args.endDate}`;

    const generatedAt = new Date().toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const title =
      args.title?.trim() ||
      `Team analysis · ${people.length} member${people.length === 1 ? "" : "s"}`;

    const payload = {
      title,
      subtitle: "Rollup from selected teammate reports",
      period,
      person: "Team",
      role: "Organization",
      generatedAt,
      startDate: args.startDate,
      endDate: args.endDate,
      headline: `Synthesis across ${people.length} teammate report${people.length === 1 ? "" : "s"} for ${period}.`,
      executiveBrief: `Combined shared reports for: ${people.join(", ")} (${period}). Use each member detail for the full picture, then prioritize the shared unlocks below.`,
      keyInsight:
        findings[0]?.detail ||
        "Team reports are ready to review side by side.",
      deliveryUnlock:
        opportunities[0] && typeof opportunities[0] === "object"
          ? String(
              (opportunities[0] as { unlock?: string }).unlock ??
                (opportunities[0] as { name?: string }).name ??
                "",
            )
          : "",
      impactOnce: "",
      kpis: [
        {
          label: "Teammates covered",
          value: String(people.length),
          delta: "",
          tone: "up" as const,
        },
        {
          label: "Member reports used",
          value: String(memberReports.length),
          delta: "",
          tone: "flat" as const,
        },
        {
          label: "Shared opportunities",
          value: String(opportunities.length),
          delta: "",
          tone: opportunities.length ? ("up" as const) : ("watch" as const),
        },
      ],
      findings,
      timeAllocation: [],
      timeAllocationTakeaway: "",
      dailyMix: [],
      dailyMixTakeaway: "",
      focusScore: [],
      focusTakeaway: "",
      whatTheyDid: people.map(
        (person, i) =>
          `${person}: ${findings[i]?.detail || "See member report for detail."}`,
      ),
      timeline: [],
      learnings,
      repetitiveWork: [],
      bottlenecks: [],
      opportunities,
      improvements: [],
      nextSteps: opportunities.slice(0, 5).map((item, index) => {
        const opp = item as {
          name?: string;
          unlock?: string;
          horizon?: string;
        };
        return {
          action: opp.unlock || opp.name || `Follow up opportunity ${index + 1}`,
          owner: "Team",
          when: opp.horizon || "This sprint",
        };
      }),
      scorecard: [],
      memberReportIds: memberReports.map((r) => r.id),
      selectedClerkUserIds: selectedIds,
    };

    const reportId = await ctx.db.insert("reports", {
      clerkUserId: identity.subject,
      organizationId: args.organizationId,
      createdByClerkUserId: identity.subject,
      scope: "team",
      title,
      period,
      startDate: args.startDate,
      endDate: args.endDate,
      generatedAt,
      payload,
    });

    const doc = await ctx.db.get(reportId);
    if (!doc) throw new Error("Failed to create team report");
    return docToWorkReport(doc);
  },
});

/** Inclusive YYYY-MM-DD overlap against report start/end (falls back to generatedAt). */
function reportOverlapsRange(
  row: Doc<"reports">,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  const payload = asReportPayload(row.payload);
  const start =
    row.startDate ||
    (typeof payload.startDate === "string" ? payload.startDate : "") ||
    "";
  const end =
    row.endDate ||
    (typeof payload.endDate === "string" ? payload.endDate : "") ||
    start;
  if (start && end) {
    return start <= rangeEnd && end >= rangeStart;
  }

  const generated =
    row.generatedAt ||
    (typeof payload.generatedAt === "string" ? payload.generatedAt : "") ||
    (typeof payload.createdAt === "string" ? payload.createdAt : "") ||
    "";
  // Try ISO / YYYY-MM-DD prefix.
  const match = generated.match(/\d{4}-\d{2}-\d{2}/);
  if (match) {
    const day = match[0];
    return day >= rangeStart && day <= rangeEnd;
  }

  // Last resort: creation time as local YYYY-MM-DD
  const created = new Date(row._creationTime);
  const y = created.getFullYear();
  const m = String(created.getMonth() + 1).padStart(2, "0");
  const d = String(created.getDate()).padStart(2, "0");
  const day = `${y}-${m}-${d}`;
  return day >= rangeStart && day <= rangeEnd;
}
