import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import {
  ClerkLoaded,
  ClerkLoading,
  SignedIn,
  SignedOut,
  useOrganizationList,
  useSession,
} from "@clerk/clerk-react";
import { ConvexUserSync } from "@/components/ConvexUserSync";
import { AppShell } from "@/components/jarbas/app-shell";
import { AuthGate } from "@/components/jarbas/auth-gate";
import { OnboardingFlow } from "@/components/jarbas/onboarding-flow";
import { OrgGate } from "@/components/jarbas/org-gate";
import { api } from "@convex/_generated/api";

function GateLoading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <p className="label-caps text-muted-foreground">Loading</p>
    </div>
  );
}

function SignedInGate() {
  const { session } = useSession();
  const me = useQuery(api.user.me);
  const completeOnboarding = useMutation(api.user.completeOnboarding);
  const { isLoaded, userMemberships, setActive } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const memberships = userMemberships.data ?? [];
  const needsOrganization = session?.currentTask?.key === "choose-organization";
  const existingOrgId = memberships[0]?.organization.id;

  // Org may already exist (create succeeded earlier) while the session task
  // is still pending - activate it instead of forcing another create form.
  useEffect(() => {
    if (!needsOrganization || !isLoaded || userMemberships.isLoading) return;
    if (!existingOrgId || !setActive) return;
    void setActive({
      organization: existingOrgId,
      navigate: async () => undefined,
    }).catch((error) => {
      console.error("Failed to activate organization for session task", error);
    });
  }, [
    existingOrgId,
    isLoaded,
    needsOrganization,
    setActive,
    userMemberships.isLoading,
  ]);

  if (needsOrganization) {
    if (!isLoaded || userMemberships.isLoading) {
      return <GateLoading />;
    }
    if (memberships.length === 0) {
      return <OrgGate />;
    }
    return <GateLoading />;
  }

  if (!isLoaded || userMemberships.isLoading || me === undefined) {
    return <GateLoading />;
  }

  if (memberships.length === 0) {
    return <OrgGate />;
  }

  if (!me?.user?.hasFinishedOnboarding) {
    return (
      <OnboardingFlow
        onComplete={() => {
          void completeOnboarding().catch((error) => {
            console.error("Failed to complete onboarding", error);
          });
        }}
      />
    );
  }

  return <AppShell />;
}

function App() {
  return (
    <>
      <ClerkLoading>
        <GateLoading />
      </ClerkLoading>

      <ClerkLoaded>
        {/* Pending sessions (e.g. choose-organization) must not look signed-out,
            or Verify succeeds and the UI never leaves AuthGate. */}
        <SignedOut treatPendingAsSignedOut={false}>
          <AuthGate />
        </SignedOut>

        <SignedIn treatPendingAsSignedOut={false}>
          <ConvexUserSync />
          <SignedInGate />
        </SignedIn>
      </ClerkLoaded>
    </>
  );
}

export default App;
