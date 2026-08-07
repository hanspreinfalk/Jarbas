import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("user")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    return {
      identity: {
        subject: identity.subject,
        name: identity.name ?? null,
        email: identity.email ?? null,
        pictureUrl: identity.pictureUrl ?? null,
      },
      user,
    };
  },
});

export const ensure = mutation({
  args: {
    name: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("user")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    // First account only — never rewrite on later sign-ins.
    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("user", {
      clerkUserId: identity.subject,
      name: args.name ?? identity.name ?? undefined,
      profileImageUrl: args.profileImageUrl ?? identity.pictureUrl ?? undefined,
      email: args.email ?? identity.email ?? undefined,
      hasFinishedOnboarding: false,
    });
  },
});

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("user")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (!existing) {
      return await ctx.db.insert("user", {
        clerkUserId: identity.subject,
        name: identity.name ?? undefined,
        profileImageUrl: identity.pictureUrl ?? undefined,
        email: identity.email ?? undefined,
        hasFinishedOnboarding: true,
      });
    }

    if (!existing.hasFinishedOnboarding) {
      await ctx.db.patch(existing._id, { hasFinishedOnboarding: true });
    }
    return existing._id;
  },
});

/** Sets composioUserId to the Clerk user id once (first connector connect). */
export const ensureComposioUserId = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("user")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (!existing) {
      return await ctx.db.insert("user", {
        clerkUserId: identity.subject,
        name: identity.name ?? undefined,
        profileImageUrl: identity.pictureUrl ?? undefined,
        email: identity.email ?? undefined,
        hasFinishedOnboarding: false,
        composioUserId: identity.subject,
      });
    }

    if (!existing.composioUserId) {
      await ctx.db.patch(existing._id, {
        composioUserId: identity.subject,
      });
    }

    return existing._id;
  },
});
