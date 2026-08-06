import { useState } from "react";
import {
  ArrowRight,
  Eye,
  ExternalLink,
  Lock,
  Monitor,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/lib/onboarding";
import { openPrivacySettings } from "@/lib/privacy-settings";
import { cn } from "@/lib/utils";

type Step = "welcome" | "permissions";

const PILLARS = [
  {
    icon: Monitor,
    title: "See how work happens",
    detail: "Record your screen and workflows.",
  },
  {
    icon: Sparkles,
    title: "Find delivery unlocks",
    detail: "Turn repeats into agents.",
  },
  {
    icon: Lock,
    title: "Stay private and local",
    detail: "Everything stays on this device.",
  },
] as const;

const PERMISSIONS = [
  {
    id: "screen-recording",
    label: "Screen Recording",
    description: "Capture what is on screen.",
    pane: "screen-recording",
  },
  {
    id: "accessibility",
    label: "Accessibility",
    description: "Read UI and app context.",
    pane: "accessibility",
  },
] as const;

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>("welcome");
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  function finish() {
    completeOnboarding();
    onComplete();
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center bg-primary font-display text-sm font-bold text-primary-foreground">
            J
          </span>
          <span className="font-display text-base tracking-tight text-foreground">
            Jarbas
          </span>
        </div>
        <p className="label-caps text-muted-foreground">
          {step === "welcome" ? "01 · Welcome" : "02 · Permissions"}
        </p>
      </header>

      <div className="jarbas-shell flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
          {step === "welcome" ? (
            <div className="animate-rise">
              <p className="label-caps text-muted-foreground">Welcome</p>
              <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
                Learn how you work. Ship agents in weeks.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                Capture work, find unlocks, ship agents in weeks.
              </p>

              <ul className="mt-8 space-y-3">
                {PILLARS.map((pillar, index) => {
                  const Icon = pillar.icon;
                  return (
                    <li
                      key={pillar.title}
                      className="animate-rise flex gap-3 border border-border bg-card px-4 py-3"
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-foreground">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold tracking-tight text-foreground">
                          {pillar.title}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {pillar.detail}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-8">
                <Button
                  type="button"
                  className="rounded-none"
                  onClick={() => setStep("permissions")}
                >
                  Continue
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="animate-rise">
              <p className="label-caps text-muted-foreground">Permissions</p>
              <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
                Allow Jarbas to see your work
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                Needed for capture. Stays private and local.
              </p>

              <ul className="mt-8 divide-y divide-border border border-border bg-card">
                {PERMISSIONS.map((permission) => {
                  const isOpen = opened[permission.id];
                  return (
                    <li
                      key={permission.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex min-w-0 gap-3">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-foreground">
                          <Eye className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {permission.label}
                            </p>
                            <span
                              className={cn(
                                "label-caps border px-1.5 py-0.5 text-[10px]",
                                isOpen
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border bg-muted text-muted-foreground",
                              )}
                            >
                              {isOpen ? "Opened" : "Required"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {permission.description}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 rounded-none"
                        onClick={() => {
                          void openPrivacySettings(permission.pane);
                          setOpened((current) => ({
                            ...current,
                            [permission.id]: true,
                          }));
                        }}
                      >
                        Open Settings
                        <ExternalLink className="size-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none"
                  onClick={() => setStep("welcome")}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="rounded-none"
                  onClick={finish}
                >
                  Enter Jarbas
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
