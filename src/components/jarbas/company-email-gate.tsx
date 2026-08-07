import { useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import {
  COMPANY_EMAIL_REQUIRED_MESSAGE,
  isPersonalEmail,
} from "@/lib/company-email";
import { signOutAndClearLocalAuth } from "@/lib/auth-origin";

const REJECT_STORAGE_KEY = "jarbas:company-email-rejected";

export function stashCompanyEmailRejection(message = COMPANY_EMAIL_REQUIRED_MESSAGE) {
  try {
    sessionStorage.setItem(REJECT_STORAGE_KEY, message);
  } catch {
    // ignore
  }
}

export function takeCompanyEmailRejection(): string | null {
  try {
    const value = sessionStorage.getItem(REJECT_STORAGE_KEY);
    if (value) sessionStorage.removeItem(REJECT_STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}

/**
 * Blocks Google (and other OAuth) sessions that land on a personal email.
 * Email/password legacy sign-in is left alone — AuthGate already blocks new signups.
 */
export function CompanyEmailGate({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();
  const { isLoaded, user } = useUser();
  const [blocking, setBlocking] = useState(false);
  const signingOutRef = useRef(false);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const signedInWithGoogle = (user?.externalAccounts ?? []).some(
    (account) => account.provider === "google",
  );
  const mustReject =
    Boolean(email) && isPersonalEmail(email) && signedInWithGoogle;

  useEffect(() => {
    if (!isLoaded || !user || !mustReject || signingOutRef.current) return;
    signingOutRef.current = true;
    setBlocking(true);
    stashCompanyEmailRejection();
    void signOutAndClearLocalAuth(clerk).finally(() => {
      signingOutRef.current = false;
    });
  }, [clerk, isLoaded, mustReject, user]);

  if (!isLoaded) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="label-caps text-muted-foreground">Loading</p>
      </div>
    );
  }

  if (mustReject || blocking) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center bg-background px-4">
        <p className="label-caps text-muted-foreground">Account</p>
        <h1 className="mt-2 font-display text-2xl tracking-tight text-foreground">
          Company email required
        </h1>
        <p className="mt-3 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
          {COMPANY_EMAIL_REQUIRED_MESSAGE}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6 rounded-none"
          onClick={() => {
            stashCompanyEmailRejection();
            void signOutAndClearLocalAuth(clerk);
          }}
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  return children;
}
