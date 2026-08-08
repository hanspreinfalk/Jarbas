import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { resolveAppLogo } from "@/lib/app-logos";
import { cn } from "@/lib/utils";

function AppLogoMark({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const app = resolveAppLogo(name);
  const isJarbas = app.name.trim().toLowerCase() === "jarbas";
  const candidates = [app.logoUrl, ...app.logoFallbacks].filter(
    (url): url is string => Boolean(url),
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setExhausted(false);
  }, [name]);

  const logoUrl =
    !exhausted && candidates.length > 0
      ? (candidates[candidateIndex] ?? null)
      : null;
  const isSimpleIcon = Boolean(logoUrl?.includes("simple-icons"));

  if (isJarbas) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex size-3.5 shrink-0 items-center justify-center bg-primary text-[8px] font-bold text-primary-foreground",
          className,
        )}
      >
        J
      </span>
    );
  }

  if (logoUrl) {
    return (
      <img
        key={logoUrl}
        src={logoUrl}
        alt=""
        className={cn(
          "size-3.5 shrink-0 object-contain",
          isSimpleIcon && "dark:invert",
          className,
        )}
        loading="lazy"
        onError={() => {
          if (candidateIndex + 1 < candidates.length) {
            setCandidateIndex(candidateIndex + 1);
          } else {
            setExhausted(true);
          }
        }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-3.5 shrink-0 items-center justify-center border border-border bg-muted text-[8px] font-semibold text-muted-foreground",
        className,
      )}
    >
      {app.fallback}
    </span>
  );
}

export function AppBadge({
  name,
  className,
  onRemove,
  removeDisabled,
}: {
  name: string;
  className?: string;
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  const app = resolveAppLogo(name);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground",
        className,
      )}
    >
      <AppLogoMark name={name} />
      <span className="truncate">{app.name}</span>
      {onRemove ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          disabled={removeDisabled}
          aria-label={`Remove ${app.name}`}
          onClick={onRemove}
        >
          <X className="size-3" />
        </button>
      ) : null}
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

export { AppLogoMark };
