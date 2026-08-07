import { action } from "./_generated/server";

/**
 * Returns the shared Composio API key from Convex environment variables.
 * Authenticated clients only — used by the desktop app so packaged builds
 * do not need a local COMPOSIO_API_KEY in .env.local.
 */
export const getApiKey = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const key = process.env.COMPOSIO_API_KEY?.trim();
    if (!key) {
      throw new Error(
        "COMPOSIO_API_KEY is not set in Convex. Run: npx convex env set COMPOSIO_API_KEY <key>",
      );
    }

    return key;
  },
});
