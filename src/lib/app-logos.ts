import clerkLogo from "@/assets/clerk.svg";
import convexLogo from "@/assets/convex.svg";
import googleChromeLogo from "@/assets/google-chrome.svg";
import whatsappLogo from "@/assets/whatsapp.svg";
import xcodeLogo from "@/assets/xcode.png";

/**
 * Display-name → Composio toolkit slug.
 * Logos: https://logos.composio.dev/api/{slug}
 */
const COMPOSIO_SLUG_BY_NAME: Record<string, string> = {
  // Google
  "google drive": "googledrive",
  drive: "googledrive",
  googledrive: "googledrive",
  "google sheets": "googlesheets",
  sheets: "googlesheets",
  googlesheets: "googlesheets",
  gmail: "gmail",
  "google calendar": "googlecalendar",
  calendar: "googlecalendar",
  googlecalendar: "googlecalendar",
  "google docs": "googledocs",
  docs: "googledocs",
  googledocs: "googledocs",
  "google meet": "googlemeet",
  googlemeet: "googlemeet",
  meet: "googlemeet",

  // Dev / product
  github: "github",
  linear: "linear",
  notion: "notion",
  cursor: "cursor",
  clerk: "clerk",
  convex: "convex",
  figma: "figma",
  postman: "postman",
  vercel: "vercel",
  netlify: "netlify",
  cloudflare: "cloudflare",
  openai: "openai",
  stripe: "stripe",
  hubspot: "hubspot",
  salesforce: "salesforce",
  airtable: "airtable",
  asana: "asana",
  jira: "jira",
  confluence: "confluence",
  trello: "trello",
  todoist: "todoist",
  clickup: "clickup",
  bitbucket: "bitbucket",
  gitlab: "gitlab",
  dropbox: "dropbox",
  canva: "canva",
  miro: "miro",
  outlook: "outlook",
  "microsoft outlook": "outlook",
  excel: "excel",
  "microsoft excel": "excel",
  "microsoft teams": "microsoft_teams",
  "ms teams": "microsoft_teams",
  microsoft_teams: "microsoft_teams",

  // Messaging / media
  slack: "slack",
  discord: "discord",
  spotify: "spotify",
  telegram: "telegram",
  whatsapp: "whatsapp",
  zoom: "zoom",

  // Composio tools
  "browser tool": "browser_tool",
  browserbase: "browserbase_tool",
};

/**
 * Display-name → Simple Icons slug (jsDelivr npm package).
 * Covers common desktop apps Composio does not logo.
 * Icons: https://cdn.jsdelivr.net/npm/simple-icons@11/icons/{slug}.svg
 */
const SIMPLE_ICONS_BY_NAME: Record<string, string> = {
  // Browsers
  safari: "safari",
  firefox: "firefox",
  "mozilla firefox": "firefox",
  arc: "arc",
  "arc browser": "arc",
  brave: "brave",
  "brave browser": "brave",
  opera: "opera",
  edge: "microsoftedge",
  "microsoft edge": "microsoftedge",
  microsoftedge: "microsoftedge",
  "google chrome": "googlechrome",
  chrome: "googlechrome",

  // Editors / IDEs / terminals
  "visual studio code": "visualstudiocode",
  "vs code": "visualstudiocode",
  vscode: "visualstudiocode",
  code: "visualstudiocode",
  docker: "docker",
  "docker desktop": "docker",
  obsidian: "obsidian",
  raycast: "raycast",
  iterm: "iterm2",
  iterm2: "iterm2",
  "iterm 2": "iterm2",
  warp: "warp",
  wezterm: "wezterm",
  sketch: "sketch",
  framer: "framer",
  loom: "loom",

  // Apple / media
  "apple music": "applemusic",
  applemusic: "applemusic",
  music: "applemusic",
  apple: "apple",

  // Microsoft Office aliases
  word: "microsoftword",
  "microsoft word": "microsoftword",
  powerpoint: "microsoftpowerpoint",
  "microsoft powerpoint": "microsoftpowerpoint",
  onedrive: "microsoftonedrive",
  "one drive": "microsoftonedrive",
  "microsoft onedrive": "microsoftonedrive",
  teams: "microsoftteams",
  "microsoft outlook": "microsoftoutlook",

  // Security
  "1password": "1password",
  lastpass: "lastpass",
  bitwarden: "bitwarden",

  // Messaging / social
  signal: "signal",
  messages: "imessage",
  imessage: "imessage",
  "apple messages": "imessage",
  messenger: "messenger",
  facebook: "facebook",
  instagram: "instagram",
  twitter: "x",
  "x (twitter)": "x",
  x: "x",
  youtube: "youtube",
  linkedin: "linkedin",
  reddit: "reddit",
  pinterest: "pinterest",
  tiktok: "tiktok",
  netflix: "netflix",

  // AI
  anthropic: "anthropic",
  perplexity: "perplexity",

  // Popular apps also on Simple Icons (offline CDN fallback)
  discord: "discord",
  spotify: "spotify",
  slack: "slack",
  linear: "linear",
  figma: "figma",
  zoom: "zoom",
  telegram: "telegram",
  github: "github",
  notion: "notion",
  gmail: "gmail",
  "google drive": "googledrive",
  "google docs": "googledocs",
  "google sheets": "googlesheets",
  "google calendar": "googlecalendar",
  "google meet": "googlemeet",
  whatsapp: "whatsapp",
  vercel: "vercel",
  stripe: "stripe",
  hubspot: "hubspot",
  salesforce: "salesforce",
  airtable: "airtable",
  asana: "asana",
  jira: "jira",
  confluence: "confluence",
  trello: "trello",
  todoist: "todoist",
  clickup: "clickup",
  bitbucket: "bitbucket",
  gitlab: "gitlab",
  dropbox: "dropbox",
  postman: "postman",
  netlify: "netlify",
  cloudflare: "cloudflare",
  miro: "miro",
  canva: "canva",
};

/** Bundled brand assets (downloaded from official / CDN sources). */
const LOCAL_LOGO_BY_NAME: Record<string, string> = {
  "google chrome": googleChromeLogo,
  chrome: googleChromeLogo,
  xcode: xcodeLogo,
  whatsapp: whatsappLogo,
  clerk: clerkLogo,
  convex: convexLogo,
};

const COMPOSIO_LOGO_BASE = "https://logos.composio.dev/api";
const SIMPLE_ICONS_BASE =
  "https://cdn.jsdelivr.net/npm/simple-icons@11/icons";

export type AppLogo = {
  name: string;
  logoUrl: string | null;
  /** Fallback glyph when no logo exists */
  fallback: string;
};

function normalizeAppName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\.app$/i, "")
    .replace(/\s+/g, " ");
}

export function resolveAppLogo(name: string): AppLogo {
  // Capture filters may use `App::Title` — resolve logo from the app side.
  const logoKeySource = name.includes("::")
    ? name.split("::")[0]?.trim() || name
    : name;
  const key = normalizeAppName(logoKeySource);
  const fallback = logoKeySource.trim().slice(0, 1).toUpperCase() || "?";

  const localLogo = LOCAL_LOGO_BY_NAME[key];
  if (localLogo) {
    return { name, logoUrl: localLogo, fallback };
  }

  const composioSlug = COMPOSIO_SLUG_BY_NAME[key];
  if (composioSlug) {
    return {
      name,
      logoUrl: `${COMPOSIO_LOGO_BASE}/${composioSlug}`,
      fallback,
    };
  }

  const simpleSlug = SIMPLE_ICONS_BY_NAME[key];
  if (simpleSlug) {
    return {
      name,
      logoUrl: `${SIMPLE_ICONS_BASE}/${simpleSlug}.svg`,
      fallback,
    };
  }

  return { name, logoUrl: null, fallback };
}

export function composioLogoUrl(slug: string) {
  return `${COMPOSIO_LOGO_BASE}/${slug}`;
}
