import { useEffect, useRef } from "react";
import { useAction } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "@convex/_generated/api";

/**
 * Pulls COMPOSIO_API_KEY from Convex env (authenticated) and caches it in the
 * Tauri host so packaged builds do not need a local .env.local key.
 */
export function ComposioKeySync() {
  const { isSignedIn, isLoaded } = useAuth({
    treatPendingAsSignedOut: false,
  });
  const getApiKey = useAction(api.composio.getApiKey);
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      syncedFor.current = null;
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const apiKey = await getApiKey();
        if (cancelled || !apiKey?.trim()) return;
        // Avoid repeat writes for the same session value.
        if (syncedFor.current === apiKey) return;
        await invoke("set_composio_api_key", { apiKey });
        syncedFor.current = apiKey;
      } catch (error) {
        console.error("Failed to sync Composio API key from Convex", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getApiKey, isLoaded, isSignedIn]);

  return null;
}
