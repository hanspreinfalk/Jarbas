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
  // Google Workspace + consumer
  "google drive": "googledrive",
  drive: "googledrive",
  googledrive: "googledrive",
  "google sheets": "googlesheets",
  sheets: "googlesheets",
  googlesheets: "googlesheets",
  "google spreadsheet": "googlesheets",
  "google spreadsheets": "googlesheets",
  gmail: "gmail",
  "google mail": "gmail",
  "google calendar": "googlecalendar",
  calendar: "googlecalendar",
  googlecalendar: "googlecalendar",
  "google docs": "googledocs",
  docs: "googledocs",
  googledocs: "googledocs",
  "google documents": "googledocs",
  "google document": "googledocs",
  "google meet": "googlemeet",
  googlemeet: "googlemeet",
  meet: "googlemeet",
  "google slides": "googleslides",
  slides: "googleslides",
  googleslides: "googleslides",
  "google presentations": "googleslides",
  "google presentation": "googleslides",
  "google photos": "googlephotos",
  googlephotos: "googlephotos",
  "google forms": "googleforms",
  googleforms: "googleforms",
  "google chat": "googlechat",
  googlechat: "googlechat",
  "google maps": "googlemaps",
  googlemaps: "googlemaps",
  maps: "googlemaps",
  youtube: "youtube",
  "you tube": "youtube",
  "google youtube": "youtube",
  "google tasks": "googletasks",
  googletasks: "googletasks",
  "google keep": "googlekeep",
  googlekeep: "googlekeep",
  keep: "googlekeep",
  "google colab": "googlecolab",
  googlecolab: "googlecolab",
  colab: "googlecolab",
  colaboratory: "googlecolab",
  "google colabatory": "googlecolab",

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
  "google mail": "gmail",
  "google drive": "googledrive",
  drive: "googledrive",
  googledrive: "googledrive",
  "google docs": "googledocs",
  docs: "googledocs",
  googledocs: "googledocs",
  "google documents": "googledocs",
  "google document": "googledocs",
  "google sheets": "googlesheets",
  sheets: "googlesheets",
  googlesheets: "googlesheets",
  "google spreadsheet": "googlesheets",
  "google spreadsheets": "googlesheets",
  "google calendar": "googlecalendar",
  calendar: "googlecalendar",
  googlecalendar: "googlecalendar",
  "google meet": "googlemeet",
  meet: "googlemeet",
  googlemeet: "googlemeet",
  "google slides": "googleslides",
  slides: "googleslides",
  googleslides: "googleslides",
  "google presentations": "googleslides",
  "google presentation": "googleslides",
  "google photos": "googlephotos",
  googlephotos: "googlephotos",
  "google forms": "googleforms",
  googleforms: "googleforms",
  "google chat": "googlechat",
  googlechat: "googlechat",
  "google maps": "googlemaps",
  maps: "googlemaps",
  googlemaps: "googlemaps",
  "google youtube": "youtube",
  "you tube": "youtube",
  "google tasks": "googletasks",
  googletasks: "googletasks",
  "google keep": "googlekeep",
  googlekeep: "googlekeep",
  keep: "googlekeep",
  "google colab": "googlecolab",
  googlecolab: "googlecolab",
  colab: "googlecolab",
  colaboratory: "googlecolab",
  google: "google",
  "google workspace": "google",
  "google cloud": "googlecloud",
  gcp: "googlecloud",
  "google ads": "googleads",
  "google analytics": "googleanalytics",
  "google translate": "googletranslate",
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

/** Host / domain fragments → canonical Google product key. */
const GOOGLE_HOST_TO_KEY: Record<string, string> = {
  "docs.google.com": "google docs",
  "sheets.google.com": "google sheets",
  "slides.google.com": "google slides",
  "drive.google.com": "google drive",
  "mail.google.com": "gmail",
  "gmail.com": "gmail",
  "calendar.google.com": "google calendar",
  "meet.google.com": "google meet",
  "photos.google.com": "google photos",
  "forms.google.com": "google forms",
  "chat.google.com": "google chat",
  "maps.google.com": "google maps",
  "www.google.com": "google",
  "google.com": "google",
  "youtube.com": "youtube",
  "www.youtube.com": "youtube",
  "youtu.be": "youtube",
  "tasks.google.com": "google tasks",
  "keep.google.com": "google keep",
  "colab.research.google.com": "google colab",
  "colab.google.com": "google colab",
  "cloud.google.com": "google cloud",
  "console.cloud.google.com": "google cloud",
  "ads.google.com": "google ads",
  "analytics.google.com": "google analytics",
  "translate.google.com": "google translate",
};

/**
 * Canonical product keys we recognize as a window-title suffix
 * (e.g. "Untitled document - Google Docs").
 */
const GOOGLE_PRODUCT_KEYS = [
  "google docs",
  "google sheets",
  "google slides",
  "google drive",
  "google calendar",
  "google meet",
  "google photos",
  "google forms",
  "google chat",
  "google maps",
  "google tasks",
  "google keep",
  "google colab",
  "google cloud",
  "google ads",
  "google analytics",
  "google translate",
  "google workspace",
  "google chrome",
  "google youtube",
  "gmail",
  "youtube",
] as const;

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
  /** Alternate remote logos if `logoUrl` fails to load. */
  logoFallbacks: string[];
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

function stripUrlNoise(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim();
}

/**
 * Map messy capture / LLM labels onto a logo key.
 * Handles domains (`docs.google.com`) and titles (`… - Google Docs`).
 */
function resolveLogoKey(raw: string): string {
  const key = normalizeAppName(raw);
  if (!key) return key;

  const host = stripUrlNoise(key);
  const hostHit = GOOGLE_HOST_TO_KEY[host];
  if (hostHit) return hostHit;

  for (const product of GOOGLE_PRODUCT_KEYS) {
    if (key === product) return product;
    if (key.endsWith(` - ${product}`) || key.endsWith(` – ${product}`)) {
      return product;
    }
    if (key.endsWith(` | ${product}`)) return product;
  }

  // "Google Docs - Chrome" / similar browser chrome suffixes
  for (const product of GOOGLE_PRODUCT_KEYS) {
    if (key.startsWith(`${product} - `) || key.startsWith(`${product} – `)) {
      return product;
    }
  }

  return key;
}

function logoUrlsForKey(key: string): { primary: string | null; fallbacks: string[] } {
  const localLogo = LOCAL_LOGO_BY_NAME[key];
  if (localLogo) {
    return { primary: localLogo, fallbacks: [] };
  }

  const composioSlug = COMPOSIO_SLUG_BY_NAME[key];
  const simpleSlug = SIMPLE_ICONS_BY_NAME[key];
  const composioUrl = composioSlug
    ? `${COMPOSIO_LOGO_BASE}/${composioSlug}`
    : null;
  const simpleUrl = simpleSlug
    ? `${SIMPLE_ICONS_BASE}/${simpleSlug}.svg`
    : null;

  if (composioUrl) {
    return {
      primary: composioUrl,
      fallbacks: simpleUrl && simpleUrl !== composioUrl ? [simpleUrl] : [],
    };
  }

  if (simpleUrl) {
    return { primary: simpleUrl, fallbacks: [] };
  }

  return { primary: null, fallbacks: [] };
}

export function resolveAppLogo(name: string): AppLogo {
  // Capture filters may use `App::Title` — resolve logo from the app side.
  const logoKeySource = name.includes("::")
    ? name.split("::")[0]?.trim() || name
    : name;
  const key = resolveLogoKey(logoKeySource);
  const fallback = logoKeySource.trim().slice(0, 1).toUpperCase() || "?";
  const { primary, fallbacks } = logoUrlsForKey(key);

  return {
    name,
    logoUrl: primary,
    logoFallbacks: fallbacks,
    fallback,
  };
}

export function composioLogoUrl(slug: string) {
  return `${COMPOSIO_LOGO_BASE}/${slug}`;
}
