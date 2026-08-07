import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { getAuthRedirectUrl } from "@/lib/auth-origin";

/**
 * Completes Clerk OAuth/SAML after authenticateWithRedirect().
 * Must mount at the path passed as redirectUrl (see AuthGate Google button).
 */
export function SsoCallback() {
  const home = getAuthRedirectUrl("/");
  const signInUrl = getAuthRedirectUrl("/");
  const signUpUrl = getAuthRedirectUrl("/");

  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <div className="space-y-3 text-center">
        <p className="label-caps text-muted-foreground">Account</p>
        <p className="font-display text-xl tracking-tight text-foreground">
          Finishing sign-in…
        </p>
        <p className="text-sm text-muted-foreground">
          Completing Google authentication. Hang tight.
        </p>
      </div>
      <AuthenticateWithRedirectCallback
        // Keep every post-OAuth hop inside the app — never Account Portal.
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
        continueSignUpUrl={home}
        signInFallbackRedirectUrl={home}
        signUpFallbackRedirectUrl={home}
        signInForceRedirectUrl={home}
        signUpForceRedirectUrl={home}
      />
      {/* Required when Clerk bot sign-up protection is enabled */}
      <div id="clerk-captcha" />
    </div>
  );
}

export function isSsoCallbackPath(pathname = window.location.pathname): boolean {
  return pathname === "/sso-callback" || pathname.endsWith("/sso-callback");
}
