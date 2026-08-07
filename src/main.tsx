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

const authRedirectUrl = getAuthRedirectUrl("/");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl={authRedirectUrl}
      signInFallbackRedirectUrl={authRedirectUrl}
      signUpFallbackRedirectUrl={authRedirectUrl}
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
