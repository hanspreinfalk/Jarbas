import { useEffect, useRef, useState } from "react";
import { useAuth, useClerk, useOrganization } from "@clerk/clerk-react";
import { usePlans } from "@clerk/clerk-react/experimental";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  activeOrgPlanSlug,
  ENTERPRISE_BOOKING_URL,
  ORG_PLAN_SLUGS,
} from "@/lib/billing";
import { cn } from "@/lib/utils";

type Tier = {
  slug: string;
  eyebrow: string;
  name: string;
  blurb: string;
  capacity: string;
  price: string;
  priceNote?: string;
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    slug: ORG_PLAN_SLUGS.free,
    eyebrow: "For yourself",
    name: "Free",
    blurb: "Learn how you work.",
    capacity: "One person · Local",
    price: "US$0",
    priceNote: "permanent",
  },
  {
    slug: ORG_PLAN_SLUGS.business,
    eyebrow: "For your team",
    name: "Business",
    blurb: "Decide what to automate.",
    capacity: "Shared workspace · up to 10 people",
    price: "US$1K",
    priceNote: "per month",
    featured: true,
  },
  {
    slug: ORG_PLAN_SLUGS.enterprise,
    eyebrow: "For your company",
    name: "Enterprise",
    blurb: "Scale the platform.",
    capacity: "Built custom to your needs",
    price: "Custom",
    priceNote: "quote",
  },
];

export function OrgPlanPricing() {
  const clerk = useClerk();
  const { has, orgId, isLoaded: authLoaded } = useAuth();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { data: plans, isLoading: plansLoading } = usePlans({
    for: "organization",
  });
  const [booking, setBooking] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const syncedKey = useRef<string | null>(null);

  const businessPlan = plans?.find((p) => p.slug === ORG_PLAN_SLUGS.business);
  const onBusiness = !!has?.({ plan: `org:${ORG_PLAN_SLUGS.business}` });
  const onEnterprise = !!has?.({ plan: `org:${ORG_PLAN_SLUGS.enterprise}` });
  const onFree = !onBusiness && !onEnterprise;
  const planSlug = activeOrgPlanSlug({ onBusiness, onEnterprise });

  useEffect(() => {
    if (!orgId || !authLoaded || !orgLoaded) return;
    const key = `${orgId}:${planSlug}`;
    if (syncedKey.current === key) return;
    syncedKey.current = key;

    void invoke("sync_org_seat_limit", {
      organizationId: orgId,
      planSlug,
    }).catch((err) => {
      console.warn("Could not sync org seat limit", err);
    });
  }, [authLoaded, orgId, orgLoaded, planSlug]);

  async function bookEnterprise() {
    setBooking(true);
    setActionError(null);
    try {
      await openUrl(ENTERPRISE_BOOKING_URL);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBooking(false);
    }
  }

  async function chooseBusiness() {
    setActionError(null);
    setCheckoutBusy(true);

    try {
      if (!orgId) {
        throw new Error("Select an organization before upgrading.");
      }
      if (!businessPlan?.id) {
        throw new Error("Business plan is not available yet. Try again in a moment.");
      }

      const openCheckout = clerk.__internal_openCheckout;
      if (typeof openCheckout !== "function") {
        throw new Error("Checkout is unavailable. Try again after updating the app.");
      }

      openCheckout({
        planId: businessPlan.id,
        planPeriod: "month",
        for: "organization",
        onClose: () => setCheckoutBusy(false),
        onSubscriptionComplete: () => {
          syncedKey.current = null;
          void invoke("sync_org_seat_limit", {
            organizationId: orgId,
            planSlug: ORG_PLAN_SLUGS.business,
          }).catch((err) => {
            console.warn("Could not sync Business seat limit", err);
          });
        },
      });

      // Drawer mount is sync; don't leave the button spinning if onClose never fires.
      window.setTimeout(() => setCheckoutBusy(false), 800);
    } catch (err) {
      setCheckoutBusy(false);
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!authLoaded || !orgLoaded || plansLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading plans…
      </div>
    );
  }

  if (!organization) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Select an organization to manage billing.
      </p>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => {
          const isFree = tier.slug === ORG_PLAN_SLUGS.free;
          const isBusiness = tier.slug === ORG_PLAN_SLUGS.business;
          const isEnterprise = tier.slug === ORG_PLAN_SLUGS.enterprise;
          const current =
            (isFree && onFree) ||
            (isBusiness && onBusiness) ||
            (isEnterprise && onEnterprise);

          return (
            <article
              key={tier.slug}
              className={cn(
                "relative flex flex-col border bg-card px-5 py-6",
                current
                  ? "border-primary"
                  : tier.featured
                    ? "border-foreground/25"
                    : "border-border",
              )}
            >
              {current ? (
                <span className="absolute top-0 right-0 bg-primary px-2 py-1 text-[10px] font-medium tracking-wide text-primary-foreground uppercase">
                  Current
                </span>
              ) : tier.featured ? (
                <span className="absolute top-0 right-0 bg-foreground px-2 py-1 text-[10px] font-medium tracking-wide text-background uppercase">
                  Team
                </span>
              ) : null}

              <p className="label-caps text-muted-foreground">{tier.eyebrow}</p>
              <h3 className="mt-3 font-display text-3xl tracking-tight text-foreground">
                {tier.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {tier.blurb}
              </p>

              <div className="mt-6 flex items-baseline gap-2">
                <p className="font-display text-2xl tracking-tight text-foreground">
                  {tier.price}
                </p>
                {tier.priceNote ? (
                  <p className="text-xs text-muted-foreground">{tier.priceNote}</p>
                ) : null}
              </div>

              {tier.capacity ? (
                <p className="mt-4 flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>{tier.capacity}</span>
                </p>
              ) : null}

              <div className="mt-auto pt-8">
                {current ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-full rounded-none"
                    disabled
                  >
                    Current plan
                  </Button>
                ) : isEnterprise ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 w-full rounded-none"
                    disabled={booking}
                    onClick={() => void bookEnterprise()}
                  >
                    {booking ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="size-3.5" />
                    )}
                    Book a call
                  </Button>
                ) : isBusiness ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 w-full rounded-none"
                    disabled={checkoutBusy || !businessPlan}
                    onClick={() => void chooseBusiness()}
                  >
                    {checkoutBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Choose Business
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-full rounded-none"
                    disabled
                  >
                    Included
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {actionError ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
