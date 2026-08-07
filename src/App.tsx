import { useMutation, useQuery } from "convex/react";
import {
  ClerkLoaded,
  ClerkLoading,
  SignedIn,
  SignedOut,
  useOrganizationList,
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
  const me = useQuery(api.user.me);
  const completeOnboarding = useMutation(api.user.completeOnboarding);
  const { isLoaded, userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  if (!isLoaded || userMemberships.isLoading || me === undefined) {
    return <GateLoading />;
  }

  const memberships = userMemberships.data ?? [];
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
        <SignedOut>
          <AuthGate />
        </SignedOut>

        <SignedIn>
          <ConvexUserSync />
          <SignedInGate />
        </SignedIn>
      </ClerkLoaded>
    </>
  );
}

export default App;
