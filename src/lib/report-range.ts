/** Inclusive YYYY-MM-DD overlap for member reports vs a team generate range. */
export function reportOverlapsDateRange(
  report: {
    startDate?: string;
    endDate?: string;
    generatedAt?: string;
    createdAt?: string;
  },
  rangeStart: string,
  rangeEnd: string,
): boolean {
  const start = (report.startDate || "").trim();
  const end = (report.endDate || start).trim();
  if (start && end) {
    return start <= rangeEnd && end >= rangeStart;
  }

  const generated = (report.generatedAt || report.createdAt || "").trim();
  const match = generated.match(/\d{4}-\d{2}-\d{2}/);
  if (match) {
    const day = match[0];
    return day >= rangeStart && day <= rangeEnd;
  }
  return true;
}
