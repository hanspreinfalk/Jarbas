import { Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReportCloudBanner({
  className,
  tense = "is",
}: {
  className?: string;
  /** Use "will" on generate dialogs; "is" on saved report views. */
  tense?: "will" | "is";
}) {
  return (
    <div
      role="note"
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 border border-sky/50 bg-sky/25 px-2 py-1 text-[11px] leading-snug text-navy/75 dark:border-sky/40 dark:bg-sky/10 dark:text-sky",
        className,
      )}
    >
      <Cloud className="size-3 shrink-0 text-navy/65 dark:text-sky/80" aria-hidden />
      <p className="min-w-0">
        {tense === "will"
          ? "Will be stored securely in the cloud. Everything else stays local."
          : "Stored securely in the cloud. Everything else stays local."}
      </p>
    </div>
  );
}
