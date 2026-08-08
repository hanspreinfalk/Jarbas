export function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? 6 : day - 1;
  next.setDate(next.getDate() - diff);
  return next;
}

export type RangePreset = {
  id: string;
  label: string;
  getRange: () => { start: Date; end: Date };
};

export const DATE_RANGE_PRESETS: RangePreset[] = [
  {
    id: "today",
    label: "Today",
    getRange: () => {
      const today = new Date();
      return { start: startOfDay(today), end: endOfDay(today) };
    },
  },
  {
    id: "yesterday",
    label: "Yesterday",
    getRange: () => {
      const day = new Date();
      day.setDate(day.getDate() - 1);
      return { start: startOfDay(day), end: endOfDay(day) };
    },
  },
  {
    id: "yesterday-today",
    label: "Yesterday + today",
    getRange: () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: startOfDay(yesterday), end: endOfDay(today) };
    },
  },
  {
    id: "last-7",
    label: "Last 7 days",
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return { start: startOfDay(start), end: endOfDay(end) };
    },
  },
  {
    id: "last-14",
    label: "Last 14 days",
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 13);
      return { start: startOfDay(start), end: endOfDay(end) };
    },
  },
  {
    id: "last-30",
    label: "Last 30 days",
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      return { start: startOfDay(start), end: endOfDay(end) };
    },
  },
  {
    id: "last-week",
    label: "Last week",
    getRange: () => {
      const thisWeekStart = startOfWeek(new Date());
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
      const lastWeekStart = startOfWeek(lastWeekEnd);
      return { start: lastWeekStart, end: endOfDay(lastWeekEnd) };
    },
  },
  {
    id: "this-month",
    label: "This month",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    },
  },
];

export function formatRangeLabel(start: string, end: string) {
  if (!start || !end) return "Choose a range";
  if (start === end) return start;
  return `${start} → ${end}`;
}

/** Explicit start/end for list cards and detail metadata. */
export function formatStartEndLabel(start?: string, end?: string) {
  const s = (start ?? "").trim();
  const e = (end ?? "").trim();
  if (!s && !e) return null;
  const startLabel = s || e;
  const endLabel = e || s;
  return `Start ${startLabel} · End ${endLabel}`;
}

/** Turn ISO / machine timestamps into a readable local date-time. */
export function formatGeneratedAt(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }
  }
  return raw;
}

/** Compact duration for report generation, e.g. "42s" or "3m 05s". */
export function formatGenerationDuration(ms?: number | null) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "";
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

/** Pull a clock time from stamps like "Aug 7, 2026 at 12:43 PM PDT". */
export function extractClockTime(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/(\d{1,2}:\d{2})\s*([AaPp][Mm])/);
  if (!match) return "";
  return `${match[1]} ${match[2].toUpperCase()}`;
}

/** Find a start/end clock range inside free text (relatedLearning, signal, …). */
export function extractTimeRangeFromText(
  ...values: Array<string | null | undefined>
): { time: string }[] | null {
  const blob = values
    .map((value) => (value ?? "").trim())
    .filter(Boolean)
    .join("\n");
  if (!blob) return null;

  const range = blob.match(
    /(\d{1,2}:\d{2})\s*([AaPp][Mm])\s*(?:to|[-–—]|and)\s*(\d{1,2}:\d{2})\s*([AaPp][Mm])/,
  );
  if (range) {
    return [
      { time: `${range[1]} ${range[2].toUpperCase()}` },
      { time: `${range[3]} ${range[4].toUpperCase()}` },
    ];
  }

  const times = Array.from(
    blob.matchAll(/(\d{1,2}:\d{2})\s*([AaPp][Mm])/g),
    (match) => `${match[1]} ${match[2].toUpperCase()}`,
  );
  if (times.length >= 2) {
    return [{ time: times[0] }, { time: times[times.length - 1] }];
  }
  if (times.length === 1) {
    return [{ time: times[0] }, { time: times[0] }];
  }
  return null;
}

/** Local clock label from epoch ms. */
export function formatClockFromMs(ms?: number | null) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseInputDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function shortMonthDay(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Compact period for list badges, e.g. "Aug 7 · 3:50–4:59 PM". */
export function formatPeriodBadge(
  period?: string | null,
  startDate?: string | null,
  endDate?: string | null,
  timeline?: { time?: string | null }[] | null,
) {
  const raw = (period ?? "").trim();
  const span = timelineTimeSpan(timeline);

  // Prefer a time-aware period string when present.
  const withTime = raw.match(
    /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+\((\d{1,2}:\d{2})\s*([AaPp][Mm])\s*[-–—]\s*(\d{1,2}:\d{2})\s*([AaPp][Mm])(?:\s+[A-Za-z]+)?\)$/,
  );
  if (withTime) {
    const mon = withTime[1].slice(0, 3);
    const day = withTime[2];
    const t1 = withTime[4];
    const a1 = withTime[5].toUpperCase();
    const t2 = withTime[6];
    const a2 = withTime[7].toUpperCase();
    if (a1 === a2) return `${mon} ${day} · ${t1}–${t2} ${a2}`;
    return `${mon} ${day} · ${t1} ${a1}–${t2} ${a2}`;
  }

  const dateOnly = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (dateOnly) {
    const label = `${dateOnly[1].slice(0, 3)} ${dateOnly[2]}`;
    return span ? `${label} · ${span}` : label;
  }

  const start = (startDate ?? "").trim();
  const end = (endDate ?? "").trim();
  const startParsed = parseInputDate(start);
  const endParsed = parseInputDate(end);

  if (startParsed && endParsed) {
    let label: string;
    if (start === end) {
      label = shortMonthDay(startParsed);
    } else if (
      startParsed.getFullYear() === endParsed.getFullYear() &&
      startParsed.getMonth() === endParsed.getMonth()
    ) {
      label = `${shortMonthDay(startParsed)}–${endParsed.getDate()}`;
    } else if (startParsed.getFullYear() === endParsed.getFullYear()) {
      label = `${shortMonthDay(startParsed)} – ${shortMonthDay(endParsed)}`;
    } else {
      label = `${shortMonthDay(startParsed)}, ${startParsed.getFullYear()} – ${shortMonthDay(endParsed)}, ${endParsed.getFullYear()}`;
    }
    // Only attach a time span on single-day periods.
    if (span && start === end) return `${label} · ${span}`;
    return label;
  }

  if (raw) return span ? `${raw} · ${span}` : raw;
  return span;
}

function timelineTimeSpan(
  timeline?: { time?: string | null }[] | null,
): string {
  if (!timeline?.length) return "";
  const times = timeline
    .map((entry) => (entry.time ?? "").trim())
    .filter(Boolean);
  if (!times.length) return "";
  const first = times[0];
  const last = times[times.length - 1];
  if (first === last) return first;

  const parse = (value: string) => {
    const match = value.match(/^(\d{1,2}:\d{2})\s*([AaPp][Mm])$/);
    if (!match) return null;
    return { t: match[1], a: match[2].toUpperCase() };
  };
  const a = parse(first);
  const b = parse(last);
  if (a && b) {
    if (a.a === b.a) return `${a.t}–${b.t} ${b.a}`;
    return `${a.t} ${a.a}–${b.t} ${b.a}`;
  }
  return `${first}–${last}`;
}
