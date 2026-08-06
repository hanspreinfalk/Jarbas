import { useState } from "react";
import { AppShell } from "@/components/jarbas/app-shell";
import { OnboardingFlow } from "@/components/jarbas/onboarding-flow";
import { isOnboardingComplete } from "@/lib/onboarding";

function App() {
  const [ready, setReady] = useState(() => isOnboardingComplete());

  if (!ready) {
    return <OnboardingFlow onComplete={() => setReady(true)} />;
  }

  return <AppShell />;
}

export default App;
