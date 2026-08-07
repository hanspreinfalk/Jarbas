/** Consumer / free-mail domains that are not allowed for new accounts or invites. */
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "yahoo.fr",
  "yahoo.de",
  "ymail.com",
  "rocketmail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "mail.com",
  "email.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "tutanota.com",
  "tuta.com",
  "fastmail.com",
  "fastmail.fm",
  "hey.com",
  "mail.ru",
  "qq.com",
  "163.com",
  "126.com",
  "rediffmail.com",
  "inbox.com",
  "hushmail.com",
]);

export const COMPANY_EMAIL_REQUIRED_MESSAGE =
  "Use a company email address.";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  if (normalized.includes(" ")) return null;
  return normalized.slice(at + 1);
}

export function isPersonalEmailDomain(domain: string): boolean {
  const host = domain.trim().toLowerCase().replace(/^\.+/, "");
  if (!host) return false;
  if (PERSONAL_EMAIL_DOMAINS.has(host)) return true;
  // Block subdomains of known consumer providers (e.g. mail.yahoo.com).
  for (const blocked of PERSONAL_EMAIL_DOMAINS) {
    if (host.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

export function isPersonalEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  return isPersonalEmailDomain(domain);
}

/** True when the address looks like email and is not a blocked personal provider. */
export function isCompanyEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  const domain = emailDomain(normalized);
  if (!domain) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  return !isPersonalEmailDomain(domain);
}

export function companyEmailError(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return "Enter an email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "Enter a valid email address.";
  }
  if (isPersonalEmail(normalized)) {
    return COMPANY_EMAIL_REQUIRED_MESSAGE;
  }
  return null;
}
