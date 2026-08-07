/** Clerk org billing — plans live in Clerk; Enterprise is sales-led. */
export const ORG_PLAN_SLUGS = {
  free: "free_org",
  business: "business",
  enterprise: "enterprise",
} as const;

export type OrgPlanSlug = (typeof ORG_PLAN_SLUGS)[keyof typeof ORG_PLAN_SLUGS];

/** Membership caps enforced via Clerk Organization max_allowed_memberships. */
export const ORG_PLAN_SEAT_LIMITS: Record<OrgPlanSlug, number> = {
  free_org: 1,
  business: 10,
  enterprise: 20,
};

/** Enterprise CTA — book a call instead of self-serve checkout. */
export const ENTERPRISE_BOOKING_URL = "https://cal.com/iagomaciel";

export function activeOrgPlanSlug(options: {
  onBusiness: boolean;
  onEnterprise: boolean;
}): OrgPlanSlug {
  if (options.onEnterprise) return ORG_PLAN_SLUGS.enterprise;
  if (options.onBusiness) return ORG_PLAN_SLUGS.business;
  return ORG_PLAN_SLUGS.free;
}
