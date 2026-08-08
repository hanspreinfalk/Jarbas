import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function JarbasMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center bg-primary font-display text-sm font-bold text-primary-foreground",
        className,
      )}
    >
      J
    </span>
  );
}

/** Letterhead used at the top of every analysis document (reports, insights, opportunities). */
export function DocumentMasthead({
  kind,
  reference,
  chips,
  title,
  byline,
  standfirst,
  size = "lg",
  children,
  className,
}: {
  /** Document type shown next to the Jarbas lockup, e.g. "Work report". */
  kind: string;
  /** Right-aligned letterhead meta, usually the period. */
  reference?: ReactNode;
  /** Badges above the title. */
  chips?: ReactNode;
  title: ReactNode;
  /** Attribution lines under the title. */
  byline?: ReactNode;
  standfirst?: ReactNode;
  size?: "md" | "lg";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      data-pdf-block
      className={cn("border-b border-border pb-8", className)}
    >
      <div aria-hidden className="h-[3px] w-full bg-primary" />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <JarbasMark />
          <span className="font-display text-sm tracking-tight text-foreground">
            Jarbas
          </span>
          <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
          <span className="label-caps hidden min-w-0 truncate text-muted-foreground sm:block">
            {kind}
          </span>
        </div>
        {reference ? (
          <p className="label-caps min-w-0 truncate text-muted-foreground">
            {reference}
          </p>
        ) : null}
      </div>

      {chips ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
          {chips}
        </div>
      ) : null}

      <h1
        className={cn(
          "font-display tracking-tight text-foreground",
          size === "lg"
            ? "text-2xl sm:text-3xl lg:text-4xl"
            : "text-2xl sm:text-3xl",
          chips ? "mt-4" : "mt-6",
        )}
      >
        {title}
      </h1>

      {byline ? (
        <div className="mt-3 space-y-0.5 text-sm text-muted-foreground">
          {byline}
        </div>
      ) : null}

      {standfirst ? (
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-foreground sm:text-[15px]">
          {standfirst}
        </p>
      ) : null}

      {children}
    </header>
  );
}
