import { action } from "./_generated/server";
import type { UserIdentity } from "convex/server";
import { v } from "convex/values";

type SyncOrgSeatLimitResult = {
  organizationId: string;
  planSlug: string;
  maxAllowedMemberships: number;
  updated: boolean;
};

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

function assertOrgAdmin(identity: UserIdentity) {
  const { orgRole } = tokenOrg(identity);
  if (!orgRole) return; // claim absent — client gates admin UI
  if (orgRole !== "org:admin" && orgRole !== "admin") {
    throw new Error("Admin only");
  }
}

function clerkSecretKey(): string {
  const key = process.env.CLERK_SECRET_KEY?.trim();
  if (!key) {
    throw new Error(
      "CLERK_SECRET_KEY is not set in Convex. Run: npx convex env set CLERK_SECRET_KEY <key>",
    );
  }
  return key;
}

function seatLimitForPlan(planSlug: string): number {
  switch (planSlug) {
    case "business":
      return 10;
    case "enterprise":
      return 20;
    default:
      return 1;
  }
}

function planRank(planSlug: string): number {
  switch (planSlug) {
    case "enterprise":
      return 3;
    case "business":
      return 2;
    default:
      return 1;
  }
}

function normalizePlanSlug(raw: string): string {
  const slug = raw.toLowerCase().replace(/ /g, "_").trim();
  if (slug.includes("enterprise")) return "enterprise";
  if (slug.includes("business")) return "business";
  return slug;
}

function bestPlanFromItems(items: unknown[]): string | null {
  let best: { rank: number; slug: string } | null = null;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const status = typeof row.status === "string" ? row.status : "";
    if (
      !(
        status === "active" ||
        status === "trialing" ||
        status === "free_trial" ||
        status === ""
      )
    ) {
      continue;
    }
    if (row.ended_at != null) continue;

    const plan = row.plan;
    let rawSlug = "";
    if (plan && typeof plan === "object") {
      const p = plan as Record<string, unknown>;
      if (typeof p.slug === "string") rawSlug = p.slug;
      else if (typeof p.name === "string") rawSlug = p.name;
    }
    if (!rawSlug) continue;
    const normalized = normalizePlanSlug(rawSlug);
    if (!normalized) continue;
    const rank = planRank(normalized);
    if (!best || rank > best.rank) best = { rank, slug: normalized };
  }
  return best?.slug ?? null;
}

async function clerkFetch(
  secret: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: string }> {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.text();
  return { status: response.status, body };
}

async function activeBillingPlanSlug(
  secret: string,
  organizationId: string,
): Promise<string | null> {
  const { status, body } = await clerkFetch(
    secret,
    `/organizations/${organizationId}/billing/subscription`,
  );

  if (status === 404) return null;
  if (status < 200 || status >= 300) {
    console.error("clerk billing subscription lookup failed", { status, body });
    throw new Error(`Could not load org billing subscription (${status}): ${body}`);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid billing subscription response");
  }

  const subscriptionStatus =
    typeof payload.status === "string" ? payload.status.toLowerCase() : "";
  if (
    subscriptionStatus === "canceled" ||
    subscriptionStatus === "cancelled" ||
    subscriptionStatus === "ended" ||
    subscriptionStatus === "expired" ||
    subscriptionStatus === "incomplete_expired"
  ) {
    return "free_org";
  }

  const itemsRaw =
    payload.subscription_items ?? payload.items ?? payload.data ?? [];
  const items = Array.isArray(itemsRaw) ? itemsRaw : [];
  return bestPlanFromItems(items);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function activeBillingPlanSlugMaybeRetry(
  secret: string,
  organizationId: string,
  force: boolean,
): Promise<string | null> {
  if (!force) {
    return activeBillingPlanSlug(secret, organizationId);
  }

  const delaysMs = [0, 400, 800, 1600, 2400];
  let last: string | null = null;

  for (let attempt = 0; attempt < delaysMs.length; attempt++) {
    const delay = delaysMs[attempt]!;
    if (delay > 0) await sleep(delay);
    try {
      last = await activeBillingPlanSlug(secret, organizationId);
      if (last && planRank(last) >= 2) return last;
      console.warn(
        `clerk billing attempt ${attempt + 1} returned ${last ?? "empty/404"}; retrying`,
      );
    } catch (error) {
      console.warn(
        `clerk billing attempt ${attempt + 1} error: ${
          error instanceof Error ? error.message : String(error)
        }; retrying`,
      );
      if (attempt === delaysMs.length - 1) throw error;
    }
  }

  return last;
}

function resolvePlanSlug(
  billingSlug: string | null,
  clientHint: string,
  force: boolean,
): string {
  const hint = clientHint.trim();
  if (force && planRank(hint) >= 2) {
    return hint;
  }
  if (billingSlug && planRank(billingSlug) >= 2) {
    return billingSlug;
  }
  if (billingSlug != null) {
    if (planRank(hint) >= 2) return hint;
    if (!billingSlug) return "free_org";
    return billingSlug;
  }
  if (planRank(hint) >= 2) return hint;
  if (!hint) return "free_org";
  return hint;
}

/**
 * Sets Organization max_allowed_memberships from Clerk Billing (or a forced
 * paid checkout hint). Uses Convex `CLERK_SECRET_KEY` so packaged apps do not
 * need a local secret.
 */
export const syncOrgSeatLimit = action({
  args: {
    organizationId: v.string(),
    planSlug: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<SyncOrgSeatLimitResult> => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity());
    assertOrgAdmin(identity);

    const organizationId = args.organizationId.trim();
    const planHint = args.planSlug.trim();
    const force = args.force ?? false;
    if (!organizationId) {
      throw new Error("organizationId is required");
    }

    const { orgId } = tokenOrg(identity);
    if (orgId && orgId !== organizationId) {
      console.warn(
        `Organization claim ${orgId} differs from requested ${organizationId}; proceeding with requested org.`,
      );
    }

    const secret = clerkSecretKey();
    const billingSlug = await activeBillingPlanSlugMaybeRetry(
      secret,
      organizationId,
      force,
    );
    const billingConfirmed = billingSlug != null;
    const resolvedPlan = resolvePlanSlug(billingSlug, planHint, force);
    const target = seatLimitForPlan(resolvedPlan);

    const currentRes = await clerkFetch(secret, `/organizations/${organizationId}`);
    if (currentRes.status < 200 || currentRes.status >= 300) {
      throw new Error(
        `Could not load organization (${currentRes.status}): ${currentRes.body}`,
      );
    }
    let currentJson: Record<string, unknown>;
    try {
      currentJson = JSON.parse(currentRes.body) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid organization response");
    }
    const currentLimit =
      typeof currentJson.max_allowed_memberships === "number"
        ? currentJson.max_allowed_memberships
        : 0;

    // Anti-clawback while billing is briefly unknown after checkout.
    if (
      target < currentLimit &&
      planRank(resolvedPlan) <= 1 &&
      !billingConfirmed &&
      (currentLimit === 10 || currentLimit === 20)
    ) {
      return {
        organizationId,
        planSlug: resolvedPlan,
        maxAllowedMemberships: currentLimit,
        updated: false,
      };
    }

    if (currentLimit === target) {
      return {
        organizationId,
        planSlug: resolvedPlan,
        maxAllowedMemberships: target,
        updated: false,
      };
    }

    const patched = await clerkFetch(secret, `/organizations/${organizationId}`, {
      method: "PATCH",
      body: JSON.stringify({ max_allowed_memberships: target }),
    });
    if (patched.status < 200 || patched.status >= 300) {
      throw new Error(
        `Could not update organization seats (${patched.status}): ${patched.body}`,
      );
    }

    const verifiedRes = await clerkFetch(
      secret,
      `/organizations/${organizationId}`,
    );
    let verifiedLimit = target;
    if (verifiedRes.status >= 200 && verifiedRes.status < 300) {
      try {
        const verifiedJson = JSON.parse(verifiedRes.body) as Record<
          string,
          unknown
        >;
        if (typeof verifiedJson.max_allowed_memberships === "number") {
          verifiedLimit = verifiedJson.max_allowed_memberships;
        }
      } catch {
        // keep target
      }
    }

    if (force && verifiedLimit < target) {
      throw new Error(
        `Seat sync did not stick: expected ${target}, got ${verifiedLimit}`,
      );
    }

    return {
      organizationId,
      planSlug: resolvedPlan,
      maxAllowedMemberships: verifiedLimit,
      updated: true,
    };
  },
});
