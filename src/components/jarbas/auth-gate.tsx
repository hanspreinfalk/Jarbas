import { useRef, useState, type FormEvent } from "react";
import { useClerk, useSignIn, useSignUp } from "@clerk/clerk-react";
import type {
  EmailCodeFactor,
  SignInFirstFactor,
  SignUpResource,
} from "@clerk/shared/types";
import { GateNav } from "@/components/jarbas/gate-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clerkErrorMessage,
  getAuthRedirectUrl,
  isAlreadySignedInError,
  isAlreadyVerifiedError,
  isIdentifierNotFoundError,
  signOutAndClearLocalAuth,
} from "@/lib/auth-origin";
import { cn } from "@/lib/utils";

type AuthMode = "sign-in" | "sign-up";
type AuthStep = "identifier" | "code";

function isEmailCodeFactor(factor: SignInFirstFactor): factor is EmailCodeFactor {
  return factor.strategy === "email_code";
}

/** Split a full name into Clerk firstName / lastName. */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out. Try again, or use a different email.`));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function AuthGate() {
  const clerk = useClerk();
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();

  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [step, setStep] = useState<AuthStep>("identifier");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const isSignUp = mode === "sign-up";
  const ready = signInLoaded && signUpLoaded && !!signIn && !!signUp;

  function resetBusy() {
    setBusy(false);
    submittingRef.current = false;
  }

  function resetFlow(nextMode: AuthMode) {
    setMode(nextMode);
    setStep("identifier");
    setCode("");
    setError(null);
    resetBusy();
  }

  /**
   * Sign out leftover client sessions. AuthGate only mounts under SignedOut, so
   * any remaining signedInSessions are stale (e.g. after wiping Clerk users) and
   * block new OAuth/email auth with "already signed in".
   */
  async function signOutLocalSessions(): Promise<void> {
    await withTimeout(
      signOutAndClearLocalAuth(clerk),
      12_000,
      "Signing out",
    );
  }

  async function recoverFromAlreadySignedIn(): Promise<boolean> {
    // Only reuse a session if this sign-in/sign-up flow just completed.
    // Leftover client sessions after a Clerk wipe look "signed in" but have no user.
    try {
      if (signUp?.status === "complete" && signUp.createdSessionId) {
        await activateSession(signUp.createdSessionId);
        return true;
      }
      if (signIn?.status === "complete" && signIn.createdSessionId) {
        await activateSession(signIn.createdSessionId);
        return true;
      }
    } catch (activateErr) {
      console.warn("Could not activate existing Clerk session", activateErr);
    }
    try {
      await signOutLocalSessions();
      setError(null);
    } catch (clearErr) {
      setError(clerkErrorMessage(clearErr));
    }
    return false;
  }

  async function activateSession(sessionId: string | null | undefined) {
    if (!sessionId) {
      throw new Error("Verification succeeded but no session was created. Start over.");
    }
    // No-op navigate: default Clerk redirects can hang the webview on "Verifying…".
    // Pending session tasks (choose-organization) are handled by App SignedInGate.
    await withTimeout(
      clerk.setActive({
        session: sessionId,
        navigate: async () => undefined,
      }),
      12_000,
      "Activating session",
    );

    const session =
      clerk.session ??
      clerk.client?.signedInSessions?.find((s) => s.id === sessionId) ??
      clerk.client?.signedInSessions?.[0];

    if (!session) {
      throw new Error("Session activated but Clerk did not retain it. Try again.");
    }

    const task = session.currentTask?.key;
    if (task && task !== "choose-organization") {
      throw new Error(
        `Sign-in needs another step (${task}). Complete it in the Clerk Account Portal, or disable that session task.`,
      );
    }
  }

  async function activateIfComplete(): Promise<boolean> {
    if (signUp?.status === "complete" && signUp.createdSessionId) {
      await activateSession(signUp.createdSessionId);
      return true;
    }
    if (signIn?.status === "complete" && signIn.createdSessionId) {
      await activateSession(signIn.createdSessionId);
      return true;
    }

    const existing =
      clerk.session?.id ??
      clerk.client?.signedInSessions?.find(
        (session) => session.status === "active" || session.status === "pending",
      )?.id ??
      clerk.client?.signedInSessions?.[0]?.id;
    if (existing) {
      await activateSession(existing);
      return true;
    }

    return false;
  }

  /** Finish Clerk fields that block status=complete after email verify (usually legal_accepted / name). */
  async function completeSignUpRequirements(
    attempt: SignUpResource,
  ): Promise<SignUpResource> {
    let current = attempt;
    const missing = current.missingFields ?? [];
    const patch: {
      legalAccepted?: boolean;
      firstName?: string;
      lastName?: string;
    } = {};

    if (missing.includes("legal_accepted")) {
      patch.legalAccepted = true;
    }

    if (missing.includes("first_name") || missing.includes("last_name")) {
      const { firstName, lastName } = splitFullName(fullName);
      if (!firstName) {
        throw new Error("Enter your name to finish creating your account.");
      }
      if (missing.includes("first_name")) patch.firstName = firstName;
      if (missing.includes("last_name")) patch.lastName = lastName || firstName;
    }

    if (Object.keys(patch).length > 0) {
      current = await withTimeout(
        current.update(patch),
        12_000,
        "Completing sign-up",
      );
      if (current.status === "complete") return current;
    }

    const stillMissing = current.missingFields ?? [];
    if (stillMissing.length === 0 && current.status === "complete") {
      return current;
    }

    if (stillMissing.includes("password")) {
      throw new Error(
        "This Clerk app requires a password at sign-up. Disable “Require password” in the Clerk Dashboard, or we can add a password step.",
      );
    }

    if (stillMissing.length > 0) {
      throw new Error(
        `Sign-up still needs: ${stillMissing.join(", ")}. Check Clerk Dashboard → User & authentication.`,
      );
    }

    return current;
  }

  async function startEmailSignIn(identifier: string) {
    if (!signIn) throw new Error("Sign-in is not ready.");
    const created = await withTimeout(
      signIn.create({ identifier }),
      12_000,
      "Starting sign-in",
    );
    const emailCodeFactor = created.supportedFirstFactors?.find(isEmailCodeFactor);
    if (!emailCodeFactor) {
      throw new Error(
        "Email code sign-in is not available for this account. Try Google, or contact support.",
      );
    }
    await withTimeout(
      signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailCodeFactor.emailAddressId,
      }),
      12_000,
      "Sending sign-in code",
    );
    setMode("sign-in");
  }

  async function startEmailSignUp(identifier: string, nameValue: string) {
    if (!signUp) throw new Error("Sign-up is not ready.");
    const { firstName, lastName } = splitFullName(nameValue);
    if (!firstName) {
      throw new Error("Enter your name to create an account.");
    }
    await withTimeout(
      signUp.create({
        emailAddress: identifier,
        firstName,
        ...(lastName ? { lastName } : { lastName: firstName }),
        legalAccepted: true,
      }),
      12_000,
      "Starting sign-up",
    );
    await withTimeout(
      signUp.prepareEmailAddressVerification({ strategy: "email_code" }),
      12_000,
      "Sending sign-up code",
    );
    setMode("sign-up");
  }

  async function handleGoogle() {
    if (!ready || !signIn || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      // redirectUrl must be a route that mounts AuthenticateWithRedirectCallback.
      // Without that handshake, Google succeeds but Clerk never creates a session.
      const redirectUrl = getAuthRedirectUrl("/sso-callback");
      const redirectUrlComplete = getAuthRedirectUrl("/");
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl,
        redirectUrlComplete,
      });
    } catch (err) {
      if (isAlreadySignedInError(err)) {
        if (await recoverFromAlreadySignedIn()) return;
        resetBusy();
        return;
      }
      setError(clerkErrorMessage(err));
      resetBusy();
    }
  }

  async function handleIdentifierSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !signIn || !signUp || submittingRef.current) return;

    const identifier = email.trim();
    if (!identifier) {
      setError("Enter your email address.");
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError(null);

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          setError("Enter your name to create an account.");
          return;
        }
        try {
          await startEmailSignUp(identifier, fullName);
        } catch (err) {
          if (isAlreadySignedInError(err)) {
            if (await recoverFromAlreadySignedIn()) return;
            return;
          }
          await startEmailSignIn(identifier).catch(() => {
            throw err;
          });
        }
      } else {
        try {
          await startEmailSignIn(identifier);
        } catch (err) {
          if (isAlreadySignedInError(err)) {
            if (await recoverFromAlreadySignedIn()) return;
            return;
          } else if (isIdentifierNotFoundError(err)) {
            if (!fullName.trim()) {
              setMode("sign-up");
              setError("No account found for that email. Enter your name to sign up.");
              return;
            }
            await startEmailSignUp(identifier, fullName);
          } else {
            throw err;
          }
        }
      }
      setStep("code");
      setCode("");
    } catch (err) {
      if (isAlreadySignedInError(err)) {
        if (await recoverFromAlreadySignedIn()) return;
        return;
      }
      setError(clerkErrorMessage(err));
    } finally {
      resetBusy();
    }
  }

  async function handleCodeSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !signIn || !signUp || submittingRef.current) return;

    const verificationCode = code.trim();
    if (!verificationCode) {
      setError("Enter the verification code from your email.");
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError(null);

    try {
      if (await activateIfComplete()) return;

      if (isSignUp) {
        let attempt = await withTimeout(
          signUp.attemptEmailAddressVerification({
            code: verificationCode,
          }),
          12_000,
          "Verifying code",
        );

        if (attempt.status === "missing_requirements") {
          attempt = await completeSignUpRequirements(attempt);
        }

        if (attempt.status === "complete") {
          await activateSession(attempt.createdSessionId);
          return;
        }

        throw new Error(
          `Sign-up is not complete yet (${attempt.status ?? "unknown"}). Try signing in instead.`,
        );
      }

      const attempt = await withTimeout(
        signIn.attemptFirstFactor({
          strategy: "email_code",
          code: verificationCode,
        }),
        12_000,
        "Verifying code",
      );
      if (attempt.status === "complete") {
        await activateSession(attempt.createdSessionId);
        return;
      }
      throw new Error("Sign-in is not complete yet. Try again.");
    } catch (err) {
      if (isAlreadyVerifiedError(err)) {
        try {
          if (
            signUp &&
            (signUp.status === "missing_requirements" ||
              (signUp.missingFields?.length ?? 0) > 0)
          ) {
            const completed = await completeSignUpRequirements(signUp);
            if (completed.status === "complete") {
              await activateSession(completed.createdSessionId);
              return;
            }
          }
          if (await activateIfComplete()) return;
        } catch (activateErr) {
          setError(clerkErrorMessage(activateErr));
          return;
        }
        setError("That code was already used. Go back and request a new one.");
        return;
      }
      setError(clerkErrorMessage(err));
    } finally {
      // Always unlock the UI. If auth succeeded, SignedIn unmounts this screen.
      resetBusy();
    }
  }

  async function resendCode() {
    if (!ready || !signIn || !signUp || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (isSignUp) {
        await withTimeout(
          signUp.prepareEmailAddressVerification({ strategy: "email_code" }),
          12_000,
          "Resending code",
        );
      } else {
        const emailCodeFactor = signIn.supportedFirstFactors?.find(isEmailCodeFactor);
        if (!emailCodeFactor) {
          throw new Error("Could not resend the code. Start over with your email.");
        }
        await withTimeout(
          signIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: emailCodeFactor.emailAddressId,
          }),
          12_000,
          "Resending code",
        );
      }
      setCode("");
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      resetBusy();
    }
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <GateNav stepLabel="01 · Account" />

      <div className="jarbas-shell flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
          <div className="animate-rise w-full text-center">
            <p className="label-caps text-muted-foreground">Account</p>
            <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground">
              {step === "code"
                ? "Check your email"
                : isSignUp
                  ? "Create your account"
                  : "Sign in to continue"}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {step === "code"
                ? `We sent a code to ${email.trim()}.`
                : "Use your Jarbas account to unlock the desktop app."}
            </p>
          </div>

          <div className="animate-fade-soft mt-8 w-full space-y-4">
            {step === "identifier" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-10 w-full rounded-none"
                  disabled={!ready || busy}
                  onClick={() => void handleGoogle()}
                >
                  <GoogleIcon className="size-4" />
                  Continue with Google
                </Button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <form
                  className="space-y-4"
                  onSubmit={(e) => void handleIdentifierSubmit(e)}
                >
                  {isSignUp ? (
                    <div className="space-y-2">
                      <label
                        htmlFor="auth-name"
                        className="label-caps text-muted-foreground"
                      >
                        Full name
                      </label>
                      <Input
                        id="auth-name"
                        type="text"
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="h-10 rounded-none bg-cream"
                        disabled={busy}
                        required
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <label
                      htmlFor="auth-email"
                      className="label-caps text-muted-foreground"
                    >
                      Email address
                    </label>
                    <Input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="h-10 rounded-none bg-cream"
                      disabled={busy}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="h-10 w-full rounded-none"
                    disabled={!ready || busy}
                  >
                    {busy ? "Continuing…" : "Continue"}
                  </Button>
                </form>
              </>
            ) : (
              <form className="space-y-4" onSubmit={(e) => void handleCodeSubmit(e)}>
                <div className="space-y-2">
                  <label
                    htmlFor="auth-code"
                    className="label-caps text-muted-foreground"
                  >
                    Verification code
                  </label>
                  <Input
                    id="auth-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter the code"
                    className="h-10 rounded-none bg-cream tracking-[0.2em]"
                    disabled={busy}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="h-10 w-full rounded-none"
                  disabled={!ready || busy}
                >
                  {busy ? "Verifying…" : "Verify"}
                </Button>
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full rounded-none"
                    disabled={busy}
                    onClick={() => void resendCode()}
                  >
                    Resend code
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full rounded-none"
                    disabled={busy}
                    onClick={() => {
                      setStep("identifier");
                      setCode("");
                      setError(null);
                      resetBusy();
                    }}
                  >
                    Use a different email
                  </Button>
                </div>
              </form>
            )}

            {error ? (
              <p
                role="alert"
                className={cn(
                  "border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
                )}
              >
                {error}
              </p>
            ) : null}

            <div id="clerk-captcha" />
          </div>

          {step === "identifier" ? (
            <p className="animate-fade-soft mt-6 text-center text-sm text-muted-foreground">
              {isSignUp ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => resetFlow("sign-in")}
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => resetFlow("sign-up")}
                  >
                    Sign up
                  </button>
                </>
              )}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
