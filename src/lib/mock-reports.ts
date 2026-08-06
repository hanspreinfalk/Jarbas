export type WorkReport = {
  id: string;
  title: string;
  subtitle: string;
  period: string;
  person: string;
  role: string;
  generatedAt: string;
  headline: string;
  executiveBrief: string;
  keyInsight: string;
  deliveryUnlock: string;
  impactOnce: string;
  kpis: {
    label: string;
    value: string;
    delta: string;
    tone: "up" | "flat" | "watch";
  }[];
  findings: {
    title: string;
    detail: string;
  }[];
  timeAllocation: {
    name: string;
    hours: number;
    fill: string;
  }[];
  timeAllocationTakeaway: string;
  dailyMix: {
    day: string;
    deepWork: number;
    collaboration: number;
    admin: number;
  }[];
  dailyMixTakeaway: string;
  focusScore: {
    day: string;
    score: number;
  }[];
  focusTakeaway: string;
  whatTheyDid: string[];
  timeline: {
    time: string;
    activity: string;
    type: "deep" | "collab" | "admin";
  }[];
  repetitiveWork: {
    activity: string;
    occurrences: number;
    minutesEach: number;
    automatable: boolean;
  }[];
  bottlenecks: {
    title: string;
    cost: string;
    unlock: string;
  }[];
  opportunities: {
    name: string;
    impact: number;
    effort: number;
    horizon: string;
  }[];
  improvements: string[];
  nextSteps: {
    action: string;
    owner: string;
    when: string;
  }[];
  scorecard: {
    label: string;
    score: number;
    note: string;
  }[];
};

export const MOCK_REPORTS: WorkReport[] = [
  {
    id: "week-31-billing-close",
    title: "Partner billing close rhythm",
    subtitle: "Operating rhythm diagnostic · Finance workflow",
    period: "Jul 28 – Aug 1, 2026",
    person: "Hans Preinfalk",
    role: "Founder",
    generatedAt: "Aug 1, 2026",
    headline:
      "Close is already agent-ready: standardize intake and you can ship monthly reconciliation in two weeks.",
    executiveBrief:
      "This week concentrated on partner billing close. High-skill judgment showed up on exceptions, while file intake, match-tab rebuilds, and summary drafting repeated on a predictable cadence. The leverage is not working harder on VLOOKUP; it is removing the rebuild loop so Finance reviews exceptions sooner.",
    keyInsight:
      "62% of close hours sat in repeatable prep. Exception judgment is the scarce skill; everything upstream can be templated or automated.",
    deliveryUnlock: "Two-week path to first live close agent",
    impactOnce: "~$18k / quarter in senior time returned to exception review",
    kpis: [
      { label: "Focus hours", value: "21.5h", delta: "+3.0h vs prior", tone: "up" },
      { label: "Repeatable share", value: "62%", delta: "Automation zone", tone: "watch" },
      { label: "Exception cycle", value: "1.8d", delta: "-0.4d", tone: "up" },
      { label: "Deep-work blocks", value: "7", delta: "Peak Wed", tone: "flat" },
    ],
    findings: [
      {
        title: "Answer first",
        detail:
          "Ship an intake + match agent before expanding scope. The close already has clear inputs, match keys, and a report skeleton.",
      },
      {
        title: "Where value sits",
        detail:
          "Hans's scarce contribution is exception framing with Finance, not assembling workbooks. Protect Thursday review as the decision forum.",
      },
      {
        title: "What to stop rebuilding",
        detail:
          "Match tabs and the executive summary outline were recreated from scratch. Reuse last cycle as the system of record.",
      },
    ],
    timeAllocation: [
      { name: "Reconciliation", hours: 9.5, fill: "var(--color-navy)" },
      { name: "Exception review", hours: 4.5, fill: "var(--color-sky)" },
      { name: "Report drafting", hours: 3.5, fill: "#3070b3" },
      { name: "Coordination", hours: 2.5, fill: "#8aa4c8" },
      { name: "Tooling / setup", hours: 1.5, fill: "#c5c0b4" },
    ],
    timeAllocationTakeaway:
      "Reconciliation plus drafting dominate. Exception review is where judgment compounds; grow that share by shrinking intake.",
    dailyMix: [
      { day: "Mon", deepWork: 2.5, collaboration: 2.0, admin: 1.5 },
      { day: "Tue", deepWork: 3.5, collaboration: 1.0, admin: 1.5 },
      { day: "Wed", deepWork: 5.0, collaboration: 0.5, admin: 1.0 },
      { day: "Thu", deepWork: 2.0, collaboration: 3.0, admin: 1.0 },
      { day: "Fri", deepWork: 2.5, collaboration: 1.5, admin: 1.0 },
    ],
    dailyMixTakeaway:
      "Wednesday held the only true deep-work spike. Tuesday intake still crowds the match window.",
    focusScore: [
      { day: "Mon", score: 58 },
      { day: "Tue", score: 64 },
      { day: "Wed", score: 88 },
      { day: "Thu", score: 61 },
      { day: "Fri", score: 72 },
    ],
    focusTakeaway:
      "Focus peaked midweek when match work was continuous. Fragmented Monday/Thursday lowered throughput despite similar hours.",
    whatTheyDid: [
      "Pulled four partner workbooks and aligned policy IDs across carrier and internal sheets",
      "Flagged premium variance above $5k and prepared Finance review pack",
      "Drafted reconciliation summary and published for leadership",
      "Updated Linear close tasks while hopping Sheets ↔ Drive ↔ Slack",
    ],
    timeline: [
      { time: "Mon AM", activity: "Finance kickoff on exception queue", type: "collab" },
      { time: "Mon PM", activity: "Imported carrier billing and payments files", type: "admin" },
      { time: "Tue", activity: "Matched policies; flagged premium variance", type: "deep" },
      { time: "Wed", activity: "Long reconciliation block; drafted close summary", type: "deep" },
      { time: "Thu", activity: "Exception walkthrough with Finance Lead", type: "collab" },
      { time: "Fri", activity: "Published report; scoped next-cycle agent", type: "deep" },
    ],
    repetitiveWork: [
      {
        activity: "Copy four Drive xlsx files into working folder",
        occurrences: 5,
        minutesEach: 12,
        automatable: true,
      },
      {
        activity: "Rebuild VLOOKUP match tabs",
        occurrences: 3,
        minutesEach: 45,
        automatable: true,
      },
      {
        activity: "Hand-write executive summary Markdown",
        occurrences: 2,
        minutesEach: 35,
        automatable: true,
      },
      {
        activity: "Reformatting exception tables for Finance",
        occurrences: 4,
        minutesEach: 18,
        automatable: true,
      },
    ],
    bottlenecks: [
      {
        title: "Finance approval gate",
        cost: "Exceptions idle ~1 day awaiting review",
        unlock: "Single Thursday decision forum with pre-briefed pack",
      },
      {
        title: "Late carrier drops",
        cost: "Match window compresses into Wed",
        unlock: "SLA reminder + agent watch on Drive folder",
      },
      {
        title: "Context switching mid-close",
        cost: "Sheets ↔ Linear breaks deep-work blocks",
        unlock: "Status sync once at end of day, not live",
      },
    ],
    opportunities: [
      { name: "Drive intake agent", impact: 90, effort: 35, horizon: "2 weeks" },
      { name: "Match + draft agent", impact: 95, effort: 55, horizon: "3 weeks" },
      { name: "Exception brief pack", impact: 70, effort: 25, horizon: "1 week" },
      { name: "Close checklist SOP", impact: 55, effort: 15, horizon: "3 days" },
    ],
    improvements: [
      "Reuse last cycle's match workbook as the default template",
      "Batch Finance questions into one Thursday review",
      "Start every close from a fixed summary skeleton",
    ],
    nextSteps: [
      {
        action: "Stand up Drive intake agent for the four workbooks",
        owner: "Hans",
        when: "This week",
      },
      {
        action: "Lock Thursday 30-min exception forum with Finance Lead",
        owner: "Hans + Finance",
        when: "Next cycle",
      },
      {
        action: "Publish two-week delivery sketch for match + report agent",
        owner: "Hans",
        when: "Fri",
      },
    ],
    scorecard: [
      { label: "Process clarity", score: 84, note: "Inputs and outputs are explicit" },
      { label: "Automation readiness", score: 78, note: "Stable match keys already exist" },
      { label: "Decision velocity", score: 61, note: "Approval still serial" },
      { label: "Focus quality", score: 72, note: "One strong deep-work day" },
    ],
  },
  {
    id: "week-30-customer-discovery",
    title: "Customer discovery and demo follow-through",
    subtitle: "Go-to-market diagnostic · Buyer workflow signal",
    period: "Jul 21 – Jul 25, 2026",
    person: "Hans Preinfalk",
    role: "Founder",
    generatedAt: "Jul 25, 2026",
    headline:
      "Buyers already believe the two-week close story. Convert talk tracks into one delivery one-pager and you accelerate every follow-up.",
    executiveBrief:
      "Discovery intensity was high: four calls, one live demo, and dense same-day follow-ups. Signal clustered around partner billing pain and exception review. Time after calls fragmented into note copying and rewrite loops instead of opportunity packaging.",
    keyInsight:
      "The message is landing. The operating gap is packaging: call themes, follow-ups, and opportunity cards should be one system, not three.",
    deliveryUnlock: "One-pager ready in under a week",
    impactOnce: "Cuts follow-up rewrite loop by ~4 hours / week",
    kpis: [
      { label: "Discovery calls", value: "4", delta: "All held", tone: "up" },
      { label: "Demo readiness", value: "71%", delta: "Reset friction", tone: "watch" },
      { label: "Same-day follow-ups", value: "100%", delta: "Strong cadence", tone: "up" },
      { label: "Theme reuse", value: "3", delta: "Billing dominant", tone: "flat" },
    ],
    findings: [
      {
        title: "Answer first",
        detail:
          "Lead every follow-up with the two-week delivery sketch. Buyers ask for the same framing; stop rewriting it from scratch.",
      },
      {
        title: "Signal concentration",
        detail:
          "Partner billing close and exception queues appeared in every conversation. That is the wedge, not a broad platform pitch.",
      },
      {
        title: "Ops drag after calls",
        detail:
          "Notes were duplicated into memory, email, and opportunities. Capture once, fan out automatically.",
      },
    ],
    timeAllocation: [
      { name: "Discovery calls", hours: 6.0, fill: "var(--color-navy)" },
      { name: "Demo prep / reset", hours: 4.0, fill: "var(--color-sky)" },
      { name: "Follow-ups", hours: 3.5, fill: "#3070b3" },
      { name: "Synthesis", hours: 2.5, fill: "#8aa4c8" },
      { name: "Internal debrief", hours: 1.5, fill: "#c5c0b4" },
    ],
    timeAllocationTakeaway:
      "Almost as much time went to prep and follow-up packaging as to live buyer conversations. Compress the after-call loop.",
    dailyMix: [
      { day: "Mon", deepWork: 1.0, collaboration: 4.0, admin: 1.5 },
      { day: "Tue", deepWork: 3.0, collaboration: 1.5, admin: 2.0 },
      { day: "Wed", deepWork: 1.5, collaboration: 3.5, admin: 1.5 },
      { day: "Thu", deepWork: 2.5, collaboration: 2.0, admin: 1.5 },
      { day: "Fri", deepWork: 3.0, collaboration: 1.0, admin: 1.0 },
    ],
    dailyMixTakeaway:
      "Collaboration-heavy Monday/Wednesday match call days. Tuesday and Friday are the synthesis windows to protect.",
    focusScore: [
      { day: "Mon", score: 52 },
      { day: "Tue", score: 74 },
      { day: "Wed", score: 57 },
      { day: "Thu", score: 68 },
      { day: "Fri", score: 81 },
    ],
    focusTakeaway:
      "Focus recovered when synthesis was blocked. Call days stay useful; keep them from owning the full afternoon.",
    whatTheyDid: [
      "Ran four discovery calls with ops and finance buyers",
      "Reworked demo around reconciliation and exception review",
      "Logged themes and tagged recurring workflow patterns",
      "Sent same-day follow-ups with a two-week delivery sketch",
    ],
    timeline: [
      { time: "Mon", activity: "Two discovery calls; billing themes tagged", type: "collab" },
      { time: "Tue AM", activity: "Demo script refined for exception queue", type: "deep" },
      { time: "Tue PM", activity: "Follow-ups and next-step holds", type: "admin" },
      { time: "Wed", activity: "Meridian demo; feature requests captured", type: "collab" },
      { time: "Thu", activity: "Debrief; opportunities board updated", type: "admin" },
      { time: "Fri", activity: "Buyer-language synthesis for next cycle", type: "deep" },
    ],
    repetitiveWork: [
      {
        activity: "Rewrite similar follow-up emails",
        occurrences: 4,
        minutesEach: 22,
        automatable: true,
      },
      {
        activity: "Copy call highlights into multiple tools",
        occurrences: 4,
        minutesEach: 15,
        automatable: true,
      },
      {
        activity: "Re-explain two-week delivery path live",
        occurrences: 4,
        minutesEach: 8,
        automatable: false,
      },
      {
        activity: "Demo environment reset",
        occurrences: 3,
        minutesEach: 28,
        automatable: true,
      },
    ],
    bottlenecks: [
      {
        title: "Triplicated call notes",
        cost: "Themes reach opportunities late",
        unlock: "Single capture → auto-tag opportunities",
      },
      {
        title: "Demo reset friction",
        cost: "Prep overruns into call buffer",
        unlock: "Frozen demo dataset with one-click restore",
      },
      {
        title: "No durable one-pager",
        cost: "ROI framing rebuilt each time",
        unlock: "Shareable two-week delivery sheet",
      },
    ],
    opportunities: [
      { name: "Delivery one-pager", impact: 88, effort: 20, horizon: "3 days" },
      { name: "Follow-up template pack", impact: 75, effort: 18, horizon: "2 days" },
      { name: "Frozen demo snapshot", impact: 80, effort: 40, horizon: "1 week" },
      { name: "Theme → opportunity sync", impact: 85, effort: 50, horizon: "2 weeks" },
    ],
    improvements: [
      "Use one follow-up template with the two-week paragraph prefilled",
      "Log call themes once, then fan into opportunities",
      "Keep a frozen demo dataset so resets stay short",
    ],
    nextSteps: [
      {
        action: "Publish partner-billing delivery one-pager",
        owner: "Hans",
        when: "Mon",
      },
      {
        action: "Book two Meridian workflow walkthroughs",
        owner: "Hans",
        when: "This week",
      },
      {
        action: "Turn top three themes into opportunity cards",
        owner: "Hans",
        when: "Fri",
      },
    ],
    scorecard: [
      { label: "Message clarity", score: 86, note: "Two-week story resonates" },
      { label: "Signal quality", score: 82, note: "Tight wedge around billing" },
      { label: "Follow-through system", score: 54, note: "Still manual packaging" },
      { label: "Demo reliability", score: 63, note: "Reset time is the drag" },
    ],
  },
  {
    id: "week-29-product-build",
    title: "Desktop shell and capture loop",
    subtitle: "Product build diagnostic · Desktop experience",
    period: "Jul 14 – Jul 18, 2026",
    person: "Hans Preinfalk",
    role: "Founder",
    generatedAt: "Jul 18, 2026",
    headline:
      "Shell foundations are in place. The next unlock is connecting live capture into Ask so the product proves value in-session.",
    executiveBrief:
      "Build energy went into navigation, theming, and layout fidelity with Deploy Co. Morning blocks produced most of the shipped UI; afternoons drifted into polish and reload cycles. Product direction is clear enough to stop debating shell chrome and start wiring capture.",
    keyInsight:
      "Semantic tokens fixed dark-mode thrash. Remaining drag is decision latency on which surface owns live capture versus Ask.",
    deliveryUnlock: "Capture → Ask wired in two weeks",
    impactOnce: "Turns the shell from navigation into a daily working surface",
    kpis: [
      { label: "Build hours", value: "24h", delta: "Morning-heavy", tone: "up" },
      { label: "Ship velocity", value: "5", delta: "Surfaces landed", tone: "up" },
      { label: "Polish loops", value: "11", delta: "Header/theme", tone: "watch" },
      { label: "Decision lag", value: "1.5d", delta: "Capture ownership", tone: "watch" },
    ],
    findings: [
      {
        title: "Answer first",
        detail:
          "Treat Recording / Ask as one product surface with two modes. Stop splitting design energy across competing homes.",
      },
      {
        title: "Quality bar is working",
        detail:
          "Logo/header alignment and theme correctness raised trust in the desktop shell. Keep that bar; do not reopen chrome debates.",
      },
      {
        title: "Reload tax",
        detail:
          "Window-title and token experiments forced full restarts. Batch chrome changes to protect deep-work mornings.",
      },
    ],
    timeAllocation: [
      { name: "Shell / navigation", hours: 7.0, fill: "var(--color-navy)" },
      { name: "Theming / tokens", hours: 5.5, fill: "var(--color-sky)" },
      { name: "Capture / Ask design", hours: 4.5, fill: "#3070b3" },
      { name: "Polish / QA", hours: 4.0, fill: "#8aa4c8" },
      { name: "Tooling restarts", hours: 3.0, fill: "#c5c0b4" },
    ],
    timeAllocationTakeaway:
      "Almost a third of time went to polish and restarts. Foundations are good enough; shift hours into capture wiring.",
    dailyMix: [
      { day: "Mon", deepWork: 4.0, collaboration: 0.5, admin: 1.5 },
      { day: "Tue", deepWork: 4.5, collaboration: 0.5, admin: 1.0 },
      { day: "Wed", deepWork: 3.0, collaboration: 1.0, admin: 2.0 },
      { day: "Thu", deepWork: 3.5, collaboration: 1.5, admin: 1.5 },
      { day: "Fri", deepWork: 2.5, collaboration: 1.0, admin: 2.0 },
    ],
    dailyMixTakeaway:
      "Monday/Tuesday mornings carried the build. Protect that pattern and park polish for Friday afternoon.",
    focusScore: [
      { day: "Mon", score: 84 },
      { day: "Tue", score: 87 },
      { day: "Wed", score: 66 },
      { day: "Thu", score: 70 },
      { day: "Fri", score: 59 },
    ],
    focusTakeaway:
      "Focus decayed as theme edge-cases piled up. Decision clarity on capture ownership would restore midweek intensity.",
    whatTheyDid: [
      "Shipped sidebar navigation across core product tabs",
      "Wired theme preference with semantic dark-mode tokens",
      "Sketched capture-to-Ask context handoff",
      "Aligned header and logo bar heights; tightened sidebar width",
    ],
    timeline: [
      { time: "Mon", activity: "Scaffolded shell layout and tabs", type: "deep" },
      { time: "Tue", activity: "Matched Deploy Co tokens and type", type: "deep" },
      { time: "Wed", activity: "Theme control + dark-mode verification", type: "admin" },
      { time: "Thu", activity: "Explored capture → Ask sample flow", type: "deep" },
      { time: "Fri", activity: "Header alignment and sidebar polish", type: "admin" },
    ],
    repetitiveWork: [
      {
        activity: "Re-check header vs logo bar height",
        occurrences: 6,
        minutesEach: 8,
        automatable: false,
      },
      {
        activity: "Toggle theme to validate hover states",
        occurrences: 12,
        minutesEach: 3,
        automatable: true,
      },
      {
        activity: "Restart app after window chrome changes",
        occurrences: 7,
        minutesEach: 4,
        automatable: false,
      },
      {
        activity: "Revisit capture vs Ask ownership notes",
        occurrences: 5,
        minutesEach: 10,
        automatable: false,
      },
    ],
    bottlenecks: [
      {
        title: "Token mixing",
        cost: "Dark-mode hover states needed rework",
        unlock: "Brand tokens fixed; semantic tokens for UI state",
      },
      {
        title: "Surface ownership ambiguity",
        cost: "Capture/Ask design stalled 1.5 days",
        unlock: "One decision memo, then build",
      },
      {
        title: "Reload cycles",
        cost: "Chrome tweaks interrupt mornings",
        unlock: "Batch window changes end-of-day",
      },
    ],
    opportunities: [
      { name: "Capture → Ask live path", impact: 96, effort: 60, horizon: "2 weeks" },
      { name: "Learning cards from close", impact: 78, effort: 35, horizon: "1 week" },
      { name: "Report export share pack", impact: 72, effort: 40, horizon: "2 weeks" },
      { name: "Visual regression checklist", impact: 58, effort: 20, horizon: "3 days" },
    ],
    improvements: [
      "Keep brand tokens constant; drive UI with semantic colors",
      "Decide Recording / Ask ownership before the next slice",
      "Batch window-chrome changes to one restart window",
    ],
    nextSteps: [
      {
        action: "Wire live capture into Ask with sample context",
        owner: "Hans",
        when: "Next 2 weeks",
      },
      {
        action: "Add first learning cards from billing close",
        owner: "Hans",
        when: "This week",
      },
      {
        action: "Write one-page decision on Recording / Ask ownership",
        owner: "Hans",
        when: "Mon",
      },
    ],
    scorecard: [
      { label: "Design system fidelity", score: 88, note: "Deploy Co reads correctly" },
      { label: "Product completeness", score: 57, note: "Shell > workflow value" },
      { label: "Build focus", score: 76, note: "Strong Mon/Tue pattern" },
      { label: "Decision clarity", score: 60, note: "Capture ownership pending" },
    ],
  },
];

function parseInputDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatDay(date: Date, opts: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString(undefined, opts);
}

/** Human period label from `YYYY-MM-DD` inputs (local). */
export function formatReportPeriod(startDate: string, endDate: string): string {
  const start = parseInputDate(startDate);
  const end = parseInputDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return startDate === endDate ? startDate : `${startDate} – ${endDate}`;
  }

  if (startDate === endDate) {
    return formatDay(start, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = formatDay(start, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" as const }),
  });
  const endLabel = formatDay(end, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

/** Placeholder generated report for a chosen timeframe (uses demo structure). */
export function buildReportForRange(
  startDate: string,
  endDate: string,
): WorkReport {
  const template = MOCK_REPORTS[0];
  const period = formatReportPeriod(startDate, endDate);
  const generatedAt = formatDay(new Date(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const id = `generated-${startDate}-${endDate}-${Date.now()}`;

  return {
    ...structuredClone(template),
    id,
    title: startDate === endDate ? `Work report · ${period}` : `Work report`,
    subtitle: "Generated from selected timeframe",
    period,
    generatedAt,
    headline: `Summary for ${period}: capture-backed rhythm report ready to review.`,
    executiveBrief: `This report covers ${period}. It uses the current report structure as a placeholder while live generation from your captured work is wired in. Review the sections below, then regenerate once capture coverage for the range is complete.`,
    keyInsight: `Timeframe locked to ${period}. Next pass should pull screen + accessibility evidence from ~/.jarbas for this window.`,
  };
}
