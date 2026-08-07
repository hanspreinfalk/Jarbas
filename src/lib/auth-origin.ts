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
