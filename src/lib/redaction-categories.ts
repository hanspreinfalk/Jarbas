/** Shared redaction category taxonomy: labels, groups, and severity ladder. */

export const REDACTION_CATEGORY_LABELS: Record<string, string> = {
  EMAIL: "Emails",
  PASSWORD: "Passwords",
  PASSWORD_DOTS: "Password dots",
  PASSWORD_FIELD: "Password fields",
  PHONE: "Phone numbers",
  CREDIT_CARD: "Credit cards",
  SSN: "SSNs",
  IP_ADDRESS: "IP addresses",
  JWT_TOKEN: "JWT tokens",
  PRIVATE_KEY: "Private keys",
  CONNECTION_STRING: "Connection strings",
  URL_WITH_CREDENTIALS: "URLs with credentials",
  STRIPE_KEY: "Stripe keys",
  ANTHROPIC_KEY: "Anthropic keys",
  OPENAI_KEY: "OpenAI keys",
  GOOGLE_API_KEY: "Google API keys",
  HUGGINGFACE_TOKEN: "Hugging Face tokens",
  GITHUB_TOKEN: "GitHub tokens",
  CLOUDFLARE_TOKEN: "Cloudflare tokens",
  SUPABASE_KEY: "Supabase keys",
  SLACK_TOKEN: "Slack tokens",
  DISCORD_TOKEN: "Discord tokens",
  GITLAB_TOKEN: "GitLab tokens",
  NPM_TOKEN: "npm tokens",
  PYPI_TOKEN: "PyPI tokens",
  DIGITALOCEAN_TOKEN: "DigitalOcean tokens",
  TELEGRAM_TOKEN: "Telegram tokens",
  TWILIO_KEY: "Twilio keys",
  SENDGRID_KEY: "SendGrid keys",
  MAILCHIMP_KEY: "Mailchimp keys",
  AWS_KEY: "AWS access keys",
  AWS_SECRET: "AWS secrets",
  AZURE_KEY: "Azure keys",
  API_KEY: "API keys",
  AUTH_TOKEN: "Auth tokens",
  ENV_SECRET: "Env secrets",
  IBAN: "IBANs",
  SEED_PHRASE: "Seed phrases",
  BACKUP_CODE: "Backup codes",
};

/** High-signal secrets only: safest default (fewest false positives). */
export const REDACTION_SECRETS_TAGS = [
  "PASSWORD",
  "PASSWORD_DOTS",
  "PASSWORD_FIELD",
  "PRIVATE_KEY",
  "CONNECTION_STRING",
  "URL_WITH_CREDENTIALS",
  "JWT_TOKEN",
  "STRIPE_KEY",
  "ANTHROPIC_KEY",
  "OPENAI_KEY",
  "GOOGLE_API_KEY",
  "HUGGINGFACE_TOKEN",
  "GITHUB_TOKEN",
  "CLOUDFLARE_TOKEN",
  "SUPABASE_KEY",
  "SLACK_TOKEN",
  "DISCORD_TOKEN",
  "GITLAB_TOKEN",
  "NPM_TOKEN",
  "PYPI_TOKEN",
  "DIGITALOCEAN_TOKEN",
  "TELEGRAM_TOKEN",
  "TWILIO_KEY",
  "SENDGRID_KEY",
  "MAILCHIMP_KEY",
  "AWS_KEY",
  "AWS_SECRET",
  "AZURE_KEY",
  "SEED_PHRASE",
  "BACKUP_CODE",
] as const;

/** Secrets + identity / financial PII. */
export const REDACTION_PII_TAGS = [
  ...REDACTION_SECRETS_TAGS,
  "EMAIL",
  "PHONE",
  "SSN",
  "CREDIT_CARD",
  "IBAN",
  "IP_ADDRESS",
] as const;

/** Everything, including broad patterns that can over-match. */
export const REDACTION_AGGRESSIVE_TAGS = Object.keys(
  REDACTION_CATEGORY_LABELS,
) as string[];

export type RedactionLadderId = "secrets" | "pii" | "aggressive" | "custom";

export type RedactionLadderPreset = {
  id: Exclude<RedactionLadderId, "custom">;
  label: string;
  detail: string;
  tags: readonly string[];
};

export const REDACTION_LADDER_PRESETS: RedactionLadderPreset[] = [
  {
    id: "secrets",
    label: "Secrets",
    detail: "Keys, passwords, tokens. Fewest false positives.",
    tags: REDACTION_SECRETS_TAGS,
  },
  {
    id: "pii",
    label: "PII",
    detail: "Secrets plus emails, phones, cards, and IDs.",
    tags: REDACTION_PII_TAGS,
  },
  {
    id: "aggressive",
    label: "Aggressive",
    detail: "Everything, including broad token/env patterns.",
    tags: REDACTION_AGGRESSIVE_TAGS,
  },
];

export type RedactionCategoryGroup = {
  id: string;
  label: string;
  tags: readonly string[];
};

export const REDACTION_CATEGORY_GROUPS: RedactionCategoryGroup[] = [
  {
    id: "passwords",
    label: "Passwords",
    tags: ["PASSWORD", "PASSWORD_DOTS", "PASSWORD_FIELD"],
  },
  {
    id: "identity",
    label: "Identity",
    tags: ["EMAIL", "PHONE", "SSN", "IBAN", "IP_ADDRESS"],
  },
  {
    id: "financial",
    label: "Financial",
    tags: ["CREDIT_CARD"],
  },
  {
    id: "credentials",
    label: "Keys & credentials",
    tags: [
      "PRIVATE_KEY",
      "CONNECTION_STRING",
      "URL_WITH_CREDENTIALS",
      "JWT_TOKEN",
      "SEED_PHRASE",
      "BACKUP_CODE",
      "STRIPE_KEY",
      "ANTHROPIC_KEY",
      "OPENAI_KEY",
      "GOOGLE_API_KEY",
      "HUGGINGFACE_TOKEN",
      "GITHUB_TOKEN",
      "CLOUDFLARE_TOKEN",
      "SUPABASE_KEY",
      "SLACK_TOKEN",
      "DISCORD_TOKEN",
      "GITLAB_TOKEN",
      "NPM_TOKEN",
      "PYPI_TOKEN",
      "DIGITALOCEAN_TOKEN",
      "TELEGRAM_TOKEN",
      "TWILIO_KEY",
      "SENDGRID_KEY",
      "MAILCHIMP_KEY",
      "AWS_KEY",
      "AWS_SECRET",
      "AZURE_KEY",
    ],
  },
  {
    id: "broad",
    label: "Broad patterns",
    tags: ["API_KEY", "AUTH_TOKEN", "ENV_SECRET"],
  },
];

export const REDACTION_CATEGORY_OPTIONS: Array<{ tag: string; label: string }> =
  Object.entries(REDACTION_CATEGORY_LABELS)
    .map(([tag, label]) => ({ tag, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

export const ALL_REDACTION_TAGS = REDACTION_CATEGORY_OPTIONS.map(
  (item) => item.tag,
);

export function redactionCategoryLabel(tag: string): string {
  return (
    REDACTION_CATEGORY_LABELS[tag] ??
    tag.replace(/_/g, " ").toLowerCase()
  );
}

function sameTagSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((tag) => set.has(tag));
}

export function matchRedactionLadder(
  tags: readonly string[],
): RedactionLadderId {
  for (const preset of REDACTION_LADDER_PRESETS) {
    if (sameTagSet(tags, preset.tags)) return preset.id;
  }
  return "custom";
}

export function tagsForLadder(
  id: Exclude<RedactionLadderId, "custom">,
): string[] {
  const preset = REDACTION_LADDER_PRESETS.find((item) => item.id === id);
  return [...(preset?.tags ?? REDACTION_SECRETS_TAGS)];
}

export function filterCategoryGroups(
  query: string,
): Array<RedactionCategoryGroup & { options: Array<{ tag: string; label: string }> }> {
  const q = query.trim().toLowerCase();
  return REDACTION_CATEGORY_GROUPS.map((group) => {
    const options = group.tags
      .map((tag) => ({
        tag,
        label: redactionCategoryLabel(tag),
      }))
      .filter((item) => {
        if (!q) return true;
        return (
          item.label.toLowerCase().includes(q) ||
          item.tag.toLowerCase().includes(q) ||
          group.label.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    return { ...group, options };
  }).filter((group) => group.options.length > 0);
}
