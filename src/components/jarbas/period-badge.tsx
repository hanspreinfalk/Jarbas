import {
  extractClockTime,
  extractTimeRangeFromText,
  formatClockFromMs,
  formatPeriodBadge,
} from "@/lib/date-range";
import { cn } from "@/lib/utils";

export function PeriodBadge({
  period,
  startDate,
  endDate,
  timeline,
  firstSeen,
  lastSeen,
  hintTexts,
  analysisStartedAt,
  analysisFinishedAt,
  className,
}: {
  period?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  timeline?: { time?: string | null }[] | null;
  firstSeen?: string | null;
  lastSeen?: string | null;
  /** Free-text fields that may contain "1:31 AM to 2:14 AM". */
  hintTexts?: Array<string | null | undefined>;
  analysisStartedAt?: number | null;
  analysisFinishedAt?: number | null;
  className?: string;
}) {
  const seenTimeline =
    timeline ??
    (() => {
      const start = extractClockTime(firstSeen);
      const end = extractClockTime(lastSeen);
      if (start || end) {
        return [{ time: start || end }, { time: end || start }];
      }

      const fromText = extractTimeRangeFromText(...(hintTexts ?? []));
      if (fromText) return fromText;

      const analysisStart = formatClockFromMs(analysisStartedAt);
      const analysisEnd = formatClockFromMs(analysisFinishedAt);
      if (analysisStart || analysisEnd) {
        return [
          { time: analysisStart || analysisEnd },
          { time: analysisEnd || analysisStart },
        ];
      }

      return null;
    })();

  const label = formatPeriodBadge(period, startDate, endDate, seenTimeline);
  if (!label) return null;

  return (
    <span
      className={cn(
        "shrink-0 border border-sky/60 bg-sky/35 px-1.5 py-0.5 text-right text-[10px] font-medium leading-snug text-navy dark:border-sky/40 dark:bg-sky/10 dark:text-sky",
        className,
      )}
    >
      {label}
    </span>
  );
}
