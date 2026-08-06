import { resolveAppLogo } from "@/lib/app-logos";
import { cn } from "@/lib/utils";

export function AppBadge({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const app = resolveAppLogo(name);
  const isJarbas = app.name.trim().toLowerCase() === "jarbas";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {isJarbas ? (
        <span
          aria-hidden
          className="flex size-3.5 shrink-0 items-center justify-center bg-primary text-[8px] font-bold text-primary-foreground"
        >
          J
        </span>
      ) : app.logoUrl ? (
        <img
          src={app.logoUrl}
          alt=""
          className="size-3.5 shrink-0 object-contain"
          loading="lazy"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-3.5 shrink-0 items-center justify-center border border-border bg-muted text-[8px] font-semibold text-muted-foreground"
        >
          {app.fallback}
        </span>
      )}
      <span className="truncate">{app.name}</span>
    </span>
  );
}

export function AppBadgeList({
  apps,
  className,
}: {
  apps: string[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {apps.map((app) => (
        <AppBadge key={app} name={app} />
      ))}
    </div>
  );
}
