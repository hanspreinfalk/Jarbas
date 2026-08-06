/**
 * Display-name → Composio toolkit slug.
 * Logos: https://logos.composio.dev/api/{slug}
 */
const COMPOSIO_SLUG_BY_NAME: Record<string, string> = {
  "google drive": "googledrive",
  drive: "googledrive",
  "google sheets": "googlesheets",
  sheets: "googlesheets",
  gmail: "gmail",
  slack: "slack",
  notion: "notion",
  linear: "linear",
  "google calendar": "googlecalendar",
  calendar: "googlecalendar",
  "google docs": "googledocs",
  docs: "googledocs",
  github: "github",
  "browser tool": "browser_tool",
  browserbase: "browserbase_tool",
  cursor: "cursor",
};

const COMPOSIO_LOGO_BASE = "https://logos.composio.dev/api";

export type AppLogo = {
  name: string;
  logoUrl: string | null;
  /** Fallback glyph when no Composio logo exists */
  fallback: string;
};

function normalizeAppName(name: string) {
  return name.trim().toLowerCase();
}

export function resolveAppLogo(name: string): AppLogo {
  const key = normalizeAppName(name);
  const slug = COMPOSIO_SLUG_BY_NAME[key];
  return {
    name,
    logoUrl: slug ? `${COMPOSIO_LOGO_BASE}/${slug}` : null,
    fallback: name.trim().slice(0, 1).toUpperCase() || "?",
  };
}

export function composioLogoUrl(slug: string) {
  return `${COMPOSIO_LOGO_BASE}/${slug}`;
}
