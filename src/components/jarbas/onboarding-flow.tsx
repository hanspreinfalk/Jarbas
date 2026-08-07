import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  ExternalLink,
  Lock,
  Monitor,
  Sparkles,
} from "lucide-react";
import { GateNav } from "@/components/jarbas/gate-nav";
import { Button } from "@/components/ui/button";
import {
  accessibilitySettingsHint,
  capturePermissionDefs,
  type CapturePermissionDef,
} from "@/lib/platform";
import {
  getAccessibilityPermissionStatus,
  getCapturePermissionSnapshot,
  openPrivacySettings,
  type AccessibilityPermissionStatus,
} from "@/lib/privacy-settings";
import { cn } from "@/lib/utils";

type Step = "welcome" | "permissions";

type PermissionId = CapturePermissionDef["id"];

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

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const permissions = useMemo(() => capturePermissionDefs(), []);
  const [step, setStep] = useState<Step>("welcome");
  const [granted, setGranted] = useState<Record<PermissionId, boolean>>({
    "screen-recording": false,
    accessibility: false,
  });
  const [accessibilityInfo, setAccessibilityInfo] =
    useState<AccessibilityPermissionStatus | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const refreshPermissions = useCallback(async () => {
    const snapshot = await getCapturePermissionSnapshot();
    setAccessibilityInfo(snapshot.accessibilityInfo);
    setGranted({
      "screen-recording": snapshot.screen,
      accessibility: snapshot.accessibility,
    });
  }, []);

  useEffect(() => {
    if (step !== "permissions") return;

    void refreshPermissions();

    function onFocus() {
      void refreshPermissions();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void refreshPermissions();
      }
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const poll = window.setInterval(() => {
      void refreshPermissions();
    }, 2500);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(poll);
    };
  }, [refreshPermissions, step]);

  function finish() {
    onComplete();
  }

  async function requestPermission(permission: CapturePermissionDef) {
    setSettingsError(null);
    if (permission.id === "accessibility" && permission.requiredOnHost) {
      // Ask macOS for THIS process (dev binary ≠ packaged Jarbas.app).
      void getAccessibilityPermissionStatus({ prompt: true });
    }
    try {
      await openPrivacySettings(permission.pane);
    } catch (error) {
      console.error("Failed to open privacy settings", error);
      setSettingsError(
        error instanceof Error
          ? error.message
          : "Could not open system settings.",
      );
    }
    await refreshPermissions();
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <GateNav
        stepLabel={step === "welcome" ? "03 · Welcome" : "04 · Permissions"}
      />

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
                Needed for capture. Stays private and local. After you enable a
                permission, quit and reopen Jarbas if the status stays Required.
              </p>
              {settingsError ? (
                <p className="mt-3 text-sm text-destructive">{settingsError}</p>
              ) : null}

              <ul className="mt-8 divide-y divide-border border border-border bg-card">
                {permissions.map((permission) => {
                  const isGranted = granted[permission.id];
                  const showProcessHint =
                    permission.id === "accessibility" &&
                    permission.requiredOnHost &&
                    !isGranted &&
                    (accessibilityInfo?.processName ||
                      accessibilityInfo?.executablePath);
                  return (
                    <li
                      key={permission.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex min-w-0 gap-3">
                        <span
                          className={cn(
                            "mt-0.5 flex size-8 shrink-0 items-center justify-center border text-foreground",
                            isGranted
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-muted",
                          )}
                        >
                          {isGranted ? (
                            <Check className="size-4" strokeWidth={2.5} />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {permission.label}
                            </p>
                            <span
                              className={cn(
                                "label-caps border px-1.5 py-0.5 text-[10px]",
                                isGranted || !permission.requiredOnHost
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border bg-muted text-muted-foreground",
                              )}
                            >
                              {permission.requiredOnHost
                                ? isGranted
                                  ? "Granted"
                                  : "Required"
                                : "Ready"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {permission.description}
                          </p>
                          {showProcessHint ? (
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                              Enable{" "}
                              <span className="font-medium text-foreground">
                                {accessibilityInfo?.processName ?? "jarbas"}
                              </span>{" "}
                              {accessibilitySettingsHint()}
                              {accessibilityInfo?.executablePath ? (
                                <>
                                  {" "}
                                  <span className="break-all font-mono text-[11px]">
                                    ({accessibilityInfo.executablePath})
                                  </span>
                                </>
                              ) : null}
                              . Packaged{" "}
                              <span className="font-medium text-foreground">
                                Jarbas
                              </span>{" "}
                              is a different entry from this development build.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 rounded-none"
                        onClick={() => {
                          void requestPermission(permission);
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
