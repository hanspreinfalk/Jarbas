import { useEffect } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";

/** Creates the Convex `user` row once for a new Clerk account (no-op if it exists). */
export function ConvexUserSync() {
  const { user, isSignedIn } = useUser();
  const ensureUser = useMutation(api.user.ensure);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    void ensureUser({
      name: user.fullName ?? user.username ?? undefined,
      profileImageUrl: user.imageUrl,
      email: user.primaryEmailAddress?.emailAddress,
    }).catch((error) => {
      console.error("Failed to ensure Convex user", error);
    });
  }, [ensureUser, isSignedIn, user]);

  return null;
}
