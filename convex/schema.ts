import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  user: defineTable({
    clerkUserId: v.string(),
    name: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    hasFinishedOnboarding: v.boolean(),
    composioUserId: v.optional(v.string()),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_composio_user", ["composioUserId"]),

  /** Cloud work reports — not stored on disk. */
  reports: defineTable({
    clerkUserId: v.string(),
    organizationId: v.string(),
    createdByClerkUserId: v.string(),
    scope: v.union(v.literal("member"), v.literal("team")),
    title: v.string(),
    period: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    generatedAt: v.optional(v.string()),
    /** Wall-clock ms from AI analysis start → finish. */
    generationDurationMs: v.optional(v.number()),
    /** Full WorkReport JSON (charts, sections, analysis transcript, …). */
    payload: v.any(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_user", ["organizationId", "clerkUserId"])
    .index("by_org_scope", ["organizationId", "scope"])
    .index("by_user", ["clerkUserId"]),
});
