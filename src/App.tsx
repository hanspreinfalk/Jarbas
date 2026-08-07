import { useMutation, useQuery } from "convex/react";
import {
  ClerkLoaded,
  ClerkLoading,
  SignedIn,
  SignedOut,
  useOrganization,
  useOrganizationList,
  useSession,
} from "@clerk/clerk-react";
import { ConvexUserSync } from "@/components/ConvexUserSync";
import { ComposioKeySync } from "@/components/ComposioKeySync";
import { ClearStorageOnSignOut } from "@/components/ClearStorageOnSignOut";
import { AppShell } from "@/components/jarbas/app-shell";
import { AuthGate } from "@/components/jarbas/auth-gate";
import { CompanyEmailGate } from "@/components/jarbas/company-email-gate";
import { OnboardingFlow } from "@/components/jarbas/onboarding-flow";
import { OrgGate } from "@/components/jarbas/org-gate";
import {
  isSsoCallbackPath,
  SsoCallback,
} from "@/components/jarbas/sso-callback";
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
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const me = useQuery(api.user.me);
  const completeOnboarding = useMutation(api.user.completeOnboarding);
  const { isLoaded, userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const memberships = userMemberships.data ?? [];
  const needsOrganization = session?.currentTask?.key === "choose-organization";

  if (!isLoaded || !orgLoaded || userMemberships.isLoading) {
    return <GateLoading />;
  }

  // Active org is already selected (create/setActive succeeded) even if the
  // memberships list is still stale — don't trap the user on OrgGate.
  const hasActiveOrganization = Boolean(organization);
  if (!hasActiveOrganization && (needsOrganization || memberships.length === 0)) {
    return <OrgGate />;
  }

  if (me === undefined) {
    return <GateLoading />;
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
  if (isSsoCallbackPath()) {
    return (
      <>
        <ClerkLoading>
          <GateLoading />
        </ClerkLoading>
        <ClerkLoaded>
          <SsoCallback />
        </ClerkLoaded>
      </>
    );
  }

  return (
    <>
      <ClerkLoading>
        <GateLoading />
      </ClerkLoading>

      <ClerkLoaded>
        <ClearStorageOnSignOut />
        {/* Pending sessions (e.g. choose-organization) must not look signed-out,
            or Verify succeeds and the UI never leaves AuthGate. */}
        <SignedOut treatPendingAsSignedOut={false}>
          <AuthGate />
        </SignedOut>

        <SignedIn treatPendingAsSignedOut={false}>
          <ConvexUserSync />
          <ComposioKeySync />
          <CompanyEmailGate>
            <SignedInGate />
          </CompanyEmailGate>
        </SignedIn>
      </ClerkLoaded>
    </>
  );
}

export default App;
