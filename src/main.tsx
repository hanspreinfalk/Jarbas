import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { getAuthRedirectUrl } from "@/lib/auth-origin";
import { jarbasClerkAppearance } from "@/lib/clerk-appearance";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

// Absolute URLs so packaged localhost (1421) and tauri:// never fall back to
// Clerk Account Portal (*.accounts.dev) after OAuth.
const authHomeUrl = getAuthRedirectUrl("/");
const authSignInUrl = getAuthRedirectUrl("/");
const authSignUpUrl = getAuthRedirectUrl("/");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      // Required for custom auth UI — without these, OAuth returns to Account Portal.
      signInUrl={authSignInUrl}
      signUpUrl={authSignUpUrl}
      afterSignOutUrl={authHomeUrl}
      signInFallbackRedirectUrl={authHomeUrl}
      signUpFallbackRedirectUrl={authHomeUrl}
      allowedRedirectProtocols={["http:", "https:", "tauri:"]}
      appearance={jarbasClerkAppearance}
    >
      <ConvexClientProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <App />
        </ThemeProvider>
      </ConvexClientProvider>
    </ClerkProvider>
  </React.StrictMode>,
);
