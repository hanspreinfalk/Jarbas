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
