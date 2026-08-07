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
});
