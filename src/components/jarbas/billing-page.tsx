import { OrgPlanPricing } from "@/components/jarbas/org-plan-pricing";

export function BillingPage() {
  return (
    <div className="animate-rise mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="label-caps text-muted-foreground">Jarbas</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        Pricing
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        One platform. Three ways to use it: start alone, coordinate a team, or
        scale across the company.
      </p>

      <section className="mt-10">
        <div className="mb-4">
          <p className="label-caps text-primary">Plans</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Organization billing
          </h2>
        </div>
        <OrgPlanPricing />
      </section>
    </div>
  );
}
