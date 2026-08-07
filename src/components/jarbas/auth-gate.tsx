import { useState } from "react";
import { SignIn, SignUp } from "@clerk/clerk-react";
import { jarbasClerkAppearance } from "@/lib/clerk-appearance";

const authAppearance = {
  ...jarbasClerkAppearance,
  elements: {
    ...jarbasClerkAppearance.elements,
    header: "hidden!",
    headerTitle: "hidden!",
    headerSubtitle: "hidden!",
    card: `${jarbasClerkAppearance.elements.card} pt-5!`,
  },
};

type AuthMode = "sign-in" | "sign-up";

export function AuthGate() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const isSignUp = mode === "sign-up";

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center bg-primary font-display text-sm font-bold text-primary-foreground">
            J
          </span>
          <span className="font-display text-base tracking-tight text-foreground">
            Jarbas
          </span>
        </div>
        <p className="label-caps text-muted-foreground">01 · Account</p>
      </header>

      <div className="jarbas-shell flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
          <div className="animate-rise w-full text-center">
            <p className="label-caps text-muted-foreground">Account</p>
            <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground">
              {isSignUp ? "Create your account" : "Sign in to continue"}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Use your Jarbas account to unlock the desktop app.
            </p>
          </div>

          <div className="animate-fade-soft mt-4 w-full [&_.cl-cardBox]:mx-auto [&_.cl-rootBox]:mx-auto [&_.cl-rootBox]:w-full">
            {isSignUp ? (
              <SignUp
                appearance={authAppearance}
                routing="virtual"
                fallbackRedirectUrl="/"
              />
            ) : (
              <SignIn
                appearance={authAppearance}
                routing="virtual"
                fallbackRedirectUrl="/"
              />
            )}
          </div>

          <p className="animate-fade-soft mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode("sign-in")}
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
                  onClick={() => setMode("sign-up")}
                >
                  Sign up
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
