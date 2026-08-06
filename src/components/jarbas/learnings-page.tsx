import { MOCK_LEARNINGS } from "@/lib/mock-learnings";

export function LearningsPage() {
  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="label-caps text-muted-foreground">Jarbas</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        Learnings
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        What Jarbas has learned about how you work on this computer - the apps,
        rituals, and repeatable flows that show up in your day.
      </p>

      <ul className="mt-10 divide-y divide-border border border-border bg-card">
        {MOCK_LEARNINGS.map((learning, index) => (
          <li
            key={learning.id}
            className="animate-rise px-4 py-4 sm:px-5"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-caps border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {learning.category}
              </span>
              <span className="text-xs text-muted-foreground">
                {learning.frequency}
              </span>
            </div>
            <h2 className="mt-2 text-sm font-semibold tracking-tight text-foreground sm:text-base">
              {learning.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Observed · </span>
              {learning.observed}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              <span className="font-medium">Insight · </span>
              {learning.insight}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {learning.apps.map((app) => (
                <span
                  key={app}
                  className="border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {app}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
