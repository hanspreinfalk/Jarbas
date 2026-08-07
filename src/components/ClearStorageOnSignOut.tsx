import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { clearLocalAuthStorage } from "@/lib/auth-origin";

/**
 * Whenever the user transitions from signed-in → signed-out (UserButton,
 * custom menus, or forced revoke), wipe webview auth storage so the next
 * sign-in starts clean.
 */
export function ClearStorageOnSignOut() {
  const { isLoaded, isSignedIn } = useAuth({
    treatPendingAsSignedOut: false,
  });
  const wasSignedInRef = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      wasSignedInRef.current = true;
      return;
    }

    if (!wasSignedInRef.current) return;
    wasSignedInRef.current = false;
    void clearLocalAuthStorage();
  }, [isLoaded, isSignedIn]);

  return null;
}
