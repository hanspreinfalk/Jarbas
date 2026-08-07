import { useEffect, useState } from "react";
import { SignIn, SignUp } from "@clerk/clerk-react";

function useAuthHash() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return hash.includes("sign-up");
}

export function AuthGate() {
  const isSignUp = useAuthHash();

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

          <div className="animate-fade-soft mt-8 w-full [&_.cl-cardBox]:mx-auto [&_.cl-rootBox]:mx-auto [&_.cl-rootBox]:w-full">
            {isSignUp ? (
              <SignUp
                routing="hash"
                fallbackRedirectUrl="/"
                signInUrl="/#/sign-in"
              />
            ) : (
              <SignIn
                routing="hash"
                fallbackRedirectUrl="/"
                signUpUrl="/#/sign-up"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
