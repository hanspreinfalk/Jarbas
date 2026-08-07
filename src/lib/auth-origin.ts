/** Fixed port for packaged macOS/Linux builds (see src-tauri localhost plugin). */
export const PACKAGED_AUTH_PORT = 1421;

/**
 * Absolute http(s) origin for Clerk redirect_url.
 * Packaged macOS uses `tauri://localhost` by default, which Clerk rejects
 * (`invalid_url_scheme`). Production serves over http://localhost:1421 instead.
 */
export function getAuthOrigin(): string {
  if (typeof window === "undefined") {
    return `http://localhost:${PACKAGED_AUTH_PORT}`;
  }

  const { protocol, origin } = window.location;
  if (protocol === "http:" || protocol === "https:") {
    return origin;
  }

  return `http://localhost:${PACKAGED_AUTH_PORT}`;
}

export function getAuthRedirectUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getAuthOrigin()}${normalized}`;
}

/** Keep theme preference when wiping auth browser storage. */
const PRESERVE_LOCAL_STORAGE_KEYS = new Set(["theme"]);

/**
 * Clears Clerk/browser auth state in the webview (localStorage, sessionStorage,
 * IndexedDB). Call on every sign-out so stale sessions cannot block re-auth.
 */
export async function clearLocalAuthStorage(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const preserved: Array<[string, string]> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && PRESERVE_LOCAL_STORAGE_KEYS.has(key)) {
        const value = localStorage.getItem(key);
        if (value != null) preserved.push([key, value]);
      }
    }
    localStorage.clear();
    for (const [key, value] of preserved) {
      localStorage.setItem(key, value);
    }
  } catch (err) {
    console.warn("Failed to clear localStorage", err);
  }

  try {
    sessionStorage.clear();
  } catch (err) {
    console.warn("Failed to clear sessionStorage", err);
  }

  try {
    const databases =
      typeof indexedDB.databases === "function"
        ? await indexedDB.databases()
        : [];
    await Promise.all(
      databases.map(
        (db) =>
          new Promise<void>((resolve) => {
            if (!db.name) {
              resolve();
              return;
            }
            const request = indexedDB.deleteDatabase(db.name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }),
      ),
    );
  } catch (err) {
    console.warn("Failed to clear IndexedDB", err);
  }
}

type ClerkSignOutClient = {
  signOut: (options?: { redirectUrl?: string }) => Promise<void>;
};

/** Sign out of Clerk and wipe local auth storage (before and after). */
export async function signOutAndClearLocalAuth(
  clerk: ClerkSignOutClient,
  redirectUrl = getAuthRedirectUrl("/"),
): Promise<void> {
  await clearLocalAuthStorage();
  try {
    await clerk.signOut({ redirectUrl });
  } finally {
    await clearLocalAuthStorage();
  }
}

type ClerkErrorItem = {
  code?: string;
  long_message?: string;
  longMessage?: string;
  message?: string;
};

function clerkErrorItems(err: unknown): ClerkErrorItem[] {
  if (err && typeof err === "object" && "errors" in err) {
    const errors = (err as { errors?: ClerkErrorItem[] }).errors;
    if (Array.isArray(errors)) return errors;
  }
  return [];
}

export function clerkErrorMessage(err: unknown): string {
  const errors = clerkErrorItems(err);
  if (errors.length > 0) {
    return errors
      .map((e) => e.long_message || e.longMessage || e.message)
      .filter(Boolean)
      .join(" ");
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

export function isAlreadyVerifiedError(err: unknown): boolean {
  if (clerkErrorItems(err).some((e) => e.code === "verification_already_verified")) {
    return true;
  }
  const message = clerkErrorMessage(err).toLowerCase();
  return (
    message.includes("already been verified") || message.includes("already verified")
  );
}

export function isIdentifierNotFoundError(err: unknown): boolean {
  return clerkErrorItems(err).some((e) => e.code === "form_identifier_not_found");
}

export function isAlreadySignedInError(err: unknown): boolean {
  if (
    clerkErrorItems(err).some(
      (e) =>
        e.code === "session_exists" ||
        e.code === "identifier_already_signed_in" ||
        e.code === "authentication_invalid",
    )
  ) {
    return true;
  }
  const message = clerkErrorMessage(err).toLowerCase();
  return message.includes("already signed in");
}
