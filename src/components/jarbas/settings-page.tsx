import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronRight,
  History,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ProviderLogo } from "@/components/jarbas/provider-logo";
import { ThemeToggle } from "@/components/jarbas/theme-toggle";
import { AppBadge, AppLogoMark } from "@/components/jarbas/app-badge";
import {
  clearLlmApiKey,
  getLlmSettings,
  setLlmApiKey,
  type KeyStatus,
  type LlmProvider,
  type LlmSettings,
} from "@/lib/llm-settings";
import {
  accessibilitySettingsHint,
  capturePermissionDefs,
  capturePermissionsBlurb,
  thisComputerPhrase,
  type CapturePermissionDef,
} from "@/lib/platform";
import {
  getAccessibilityPermissionStatus,
  getCapturePermissionSnapshot,
  openPrivacySettings,
  type AccessibilityPermissionStatus,
} from "@/lib/privacy-settings";
import {
  ensurePiAgentInstalled,
  getPiAgentStatus,
  listenPiAgentStatus,
  type PiAgentInfo,
  type PiAgentStatus,
} from "@/lib/pi-agent";
import {
  formatBytes,
  formatFrameCount,
  getCaptureFilters,
  getCaptureStorageStats,
  getRedactionPrefs,
  redactJarbasCapture,
  resetJarbasData,
  screenpipe,
  setAutoRedactOnStop,
  setCaptureFilters,
  setEnabledRedactionCategories,
  type CaptureFilters,
  type CaptureStorageStats,
  type RedactCaptureResult,
  type ResetJarbasResult,
} from "@/lib/screenpipe";
import {
  ALL_REDACTION_TAGS,
  filterCategoryGroups,
  matchRedactionLadder,
  REDACTION_LADDER_PRESETS,
  REDACTION_SECRETS_TAGS,
  tagsForLadder,
  type RedactionLadderId,
} from "@/lib/redaction-categories";
import { redactionCountRows } from "@/lib/redaction-ui";
import type { AppTabId } from "@/lib/app-tabs";
import { cn } from "@/lib/utils";
import {
  DATE_RANGE_PRESETS,
  formatRangeLabel,
  toInputDate,
  type RangePreset,
} from "@/lib/date-range";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PermissionId = CapturePermissionDef["id"];

const EMPTY_KEYS: KeyStatus[] = [
  { provider: "anthropic", label: "Anthropic", configured: false, value: "" },
  { provider: "openai", label: "OpenAI", configured: false, value: "" },
  { provider: "google", label: "Gemini", configured: false, value: "" },
];

function agentStatusCopy(status: PiAgentStatus | undefined): {
  label: string;
  detail: string;
  tone: string;
} {
  if (!status) {
    return {
      label: "Checking…",
      detail: "One moment.",
      tone: "text-muted-foreground",
    };
  }
  switch (status.kind) {
    case "ready":
      return {
        label: "Ready",
        detail: `Ask is ready to use on ${thisComputerPhrase()}.`,
        tone: "text-primary",
      };
    case "installing":
      return {
        label: "Setting up…",
        detail: status.message || `Setting up Ask on ${thisComputerPhrase()}.`,
        tone: "text-muted-foreground",
      };
    case "failed":
      return {
        label: "Needs setup",
        detail: "Try set up again. If it still fails, reopen the app.",
        tone: "text-destructive",
      };
    case "idle":
      return {
        label: "Not set up",
        detail: "Set this up once so Ask can answer.",
        tone: "text-muted-foreground",
      };
  }
}

function ApiKeyRow({
  item,
  busy,
  onSave,
  onRemove,
}: {
  item: KeyStatus;
  busy: boolean;
  onSave: (value: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(item.value);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(item.value);
    setVisible(false);
  }, [item.value, item.provider]);

  const dirty = draft.trim() !== item.value.trim();
  const canCopy = Boolean(draft.trim());

  async function copyKey() {
    const text = draft.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can fail in restricted contexts.
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <ProviderLogo provider={item.provider} />
          <p className="text-sm font-medium text-foreground">{item.label}</p>
        </div>
        <p
          className={cn(
            "text-xs font-medium",
            item.configured ? "text-primary" : "text-muted-foreground",
          )}
        >
          {item.configured ? "Connected" : "Not connected"}
        </p>
      </div>

      <div className="mt-2 flex items-center gap-1 border border-border bg-background pr-1">
        <Input
          type={visible ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Paste your key here"
          className="h-9 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <button
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          aria-label={visible ? "Hide key" : "Show key"}
          title={visible ? "Hide" : "Show"}
          disabled={!canCopy}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
        <button
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          aria-label={copied ? "Copied" : "Copy key"}
          title={copied ? "Copied" : "Copy"}
          disabled={!canCopy}
          onClick={() => void copyKey()}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
        {item.configured ? (
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            aria-label="Remove key"
            title="Remove"
            disabled={busy}
            onClick={() => void onRemove()}
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>

      {dirty ? (
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            className="rounded-none"
            disabled={busy || !draft.trim()}
            onClick={() => void onSave(draft)}
          >
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SettingsPage({
  onNavigate,
}: {
  onNavigate?: (id: AppTabId) => void;
}) {
  const permissions = useMemo(() => capturePermissionDefs(), []);
  const resetOnboarding = useMutation(api.user.resetOnboarding);
  const [piInfo, setPiInfo] = useState<PiAgentInfo | null>(null);
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const [storage, setStorage] = useState<CaptureStorageStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingProvider, setSavingProvider] = useState<LlmProvider | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [redactOpen, setRedactOpen] = useState(false);
  const [redactPresetId, setRedactPresetId] = useState<string | "custom">(
    "today",
  );
  const [redactStartDate, setRedactStartDate] = useState(() =>
    toInputDate(new Date()),
  );
  const [redactEndDate, setRedactEndDate] = useState(() =>
    toInputDate(new Date()),
  );
  const [resetting, setResetting] = useState(false);
  const [redacting, setRedacting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [redactPreview, setRedactPreview] = useState<RedactCaptureResult | null>(
    null,
  );
  const [enabledCategories, setEnabledCategories] = useState<string[]>([
    ...REDACTION_SECRETS_TAGS,
  ]);
  const [categoriesBusy, setCategoriesBusy] = useState(false);
  const [advancedCategoriesOpen, setAdvancedCategoriesOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [replayingOnboarding, setReplayingOnboarding] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [redactError, setRedactError] = useState<string | null>(null);
  const [redactNotice, setRedactNotice] = useState<string | null>(null);
  const [autoRedactOnStop, setAutoRedactOnStopState] = useState(true);
  const [autoRedactBusy, setAutoRedactBusy] = useState(false);
  const [presetId, setPresetId] = useState<string | "custom">("last-14");
  const [startDate, setStartDate] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 13);
    return toInputDate(start);
  });
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));
  const [granted, setGranted] = useState<Record<PermissionId, boolean>>({
    "screen-recording": false,
    accessibility: false,
  });
  const [accessibilityInfo, setAccessibilityInfo] =
    useState<AccessibilityPermissionStatus | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [ignoredWindows, setIgnoredWindows] = useState<string[]>([]);
  const [ignoredUrls, setIgnoredUrls] = useState<string[]>([]);
  const [ignoreDraft, setIgnoreDraft] = useState("");
  const [ignoreUrlDraft, setIgnoreUrlDraft] = useState("");
  const [filtersBusy, setFiltersBusy] = useState(false);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [filtersNotice, setFiltersNotice] = useState<string | null>(null);

  const refreshStorage = useCallback(async () => {
    try {
      setStorage(await getCaptureStorageStats());
    } catch {
      setStorage({ root: "~/.jarbas", bytes: 0, frames: 0 });
    }
  }, []);

  const refreshRedactionPrefs = useCallback(async () => {
    try {
      const prefs = await getRedactionPrefs();
      setAutoRedactOnStopState(prefs.autoRedactOnStop);
      setEnabledCategories(
        Array.isArray(prefs.enabledCategories)
          ? prefs.enabledCategories
          : [...REDACTION_SECRETS_TAGS],
      );
    } catch {
      setAutoRedactOnStopState(true);
      setEnabledCategories([...REDACTION_SECRETS_TAGS]);
    }
  }, []);

  const refreshCaptureFilters = useCallback(async () => {
    try {
      const filters = await getCaptureFilters();
      setIgnoredWindows(
        Array.isArray(filters.ignoredWindows) ? filters.ignoredWindows : [],
      );
      setIgnoredUrls(
        Array.isArray(filters.ignoredUrls) ? filters.ignoredUrls : [],
      );
    } catch {
      setIgnoredWindows([]);
      setIgnoredUrls([]);
    }
  }, []);

  const persistCaptureFilters = useCallback(
    async (next: CaptureFilters) => {
      setFiltersBusy(true);
      setFiltersError(null);
      try {
        const saved = await setCaptureFilters(next);
        setIgnoredWindows(saved.ignoredWindows);
        setIgnoredUrls(saved.ignoredUrls);
        setFiltersNotice("Saved. Matching past captures were removed.");
      } catch {
        setFiltersError("Could not save ignore list.");
        await refreshCaptureFilters();
      } finally {
        setFiltersBusy(false);
      }
    },
    [refreshCaptureFilters],
  );

  async function addIgnoredWindow(raw: string) {
    const value = raw.trim();
    if (!value) return;
    if (ignoredWindows.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setIgnoreDraft("");
      return;
    }
    setIgnoreDraft("");
    await persistCaptureFilters({
      ignoredWindows: [...ignoredWindows, value],
      ignoredUrls,
    });
  }

  async function removeIgnoredWindow(value: string) {
    await persistCaptureFilters({
      ignoredWindows: ignoredWindows.filter((item) => item !== value),
      ignoredUrls,
    });
  }

  async function addIgnoredUrl(raw: string) {
    const value = raw.trim();
    if (!value) return;
    if (ignoredUrls.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setIgnoreUrlDraft("");
      return;
    }
    setIgnoreUrlDraft("");
    await persistCaptureFilters({
      ignoredWindows,
      ignoredUrls: [...ignoredUrls, value],
    });
  }

  async function removeIgnoredUrl(value: string) {
    await persistCaptureFilters({
      ignoredWindows,
      ignoredUrls: ignoredUrls.filter((item) => item !== value),
    });
  }

  async function onAutoRedactToggle(enabled: boolean) {
    setAutoRedactBusy(true);
    setAutoRedactOnStopState(enabled);
    try {
      const prefs = await setAutoRedactOnStop(enabled);
      setAutoRedactOnStopState(prefs.autoRedactOnStop);
      if (Array.isArray(prefs.enabledCategories)) {
        setEnabledCategories(prefs.enabledCategories);
      }
    } catch {
      setAutoRedactOnStopState(!enabled);
      setRedactError("Could not save auto-redact preference.");
    } finally {
      setAutoRedactBusy(false);
    }
  }

  async function persistEnabledCategories(next: string[]) {
    setCategoriesBusy(true);
    setEnabledCategories(next);
    setRedactPreview(null);
    try {
      const prefs = await setEnabledRedactionCategories(next);
      setEnabledCategories(prefs.enabledCategories ?? next);
    } catch {
      setRedactError("Could not save redaction categories.");
      await refreshRedactionPrefs();
    } finally {
      setCategoriesBusy(false);
    }
  }

  function applyLadder(id: Exclude<RedactionLadderId, "custom">) {
    if (categoriesBusy || redacting || previewing) return;
    void persistEnabledCategories(tagsForLadder(id));
  }

  function toggleRedactionCategory(tag: string) {
    if (categoriesBusy || redacting || previewing) return;
    const enabled = new Set(enabledCategories);
    if (enabled.has(tag)) {
      enabled.delete(tag);
    } else {
      enabled.add(tag);
    }
    void persistEnabledCategories(
      ALL_REDACTION_TAGS.filter((item) => enabled.has(item)),
    );
  }

  function toggleCategoryGroup(tags: readonly string[], enable: boolean) {
    if (categoriesBusy || redacting || previewing) return;
    const enabled = new Set(enabledCategories);
    for (const tag of tags) {
      if (enable) enabled.add(tag);
      else enabled.delete(tag);
    }
    void persistEnabledCategories(
      ALL_REDACTION_TAGS.filter((item) => enabled.has(item)),
    );
  }

  async function stopCaptureQuietly() {
    try {
      await screenpipe.stop();
    } catch {
      // Best effort - reset can still proceed if capture wasn't running.
    }
  }

  async function handleRangeDelete() {
    if (!startDate || !endDate || startDate > endDate || resetting) return;
    setResetting(true);
    setResetError(null);
    setResetNotice(null);
    try {
      await stopCaptureQuietly();
      const result: ResetJarbasResult = await resetJarbasData({
        mode: "range",
        startDate,
        endDate,
      });
      setRangeOpen(false);
      setResetNotice(result.message);
      await refreshStorage();
    } catch (error) {
      setResetError(error instanceof Error ? error.message : String(error));
    } finally {
      setResetting(false);
    }
  }

  async function handleFullReset() {
    if (resetting) return;
    setResetting(true);
    setResetError(null);
    setResetNotice(null);
    try {
      await stopCaptureQuietly();
      const result: ResetJarbasResult = await resetJarbasData({ mode: "full" });
      setFullOpen(false);
      setResetNotice(result.message);
      await refreshStorage();
      // Pi tree was wiped - kick off a fresh install.
      void ensurePiAgentInstalled(true).catch(() => undefined);
      void getPiAgentStatus()
        .then(setPiInfo)
        .catch(() => undefined);
      void getLlmSettings()
        .then(setLlmSettings)
        .catch(() => undefined);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : String(error));
    } finally {
      setResetting(false);
    }
  }

  const applyRedactPreset = useCallback((preset: RangePreset) => {
    const { start, end } = preset.getRange();
    setRedactPresetId(preset.id);
    setRedactStartDate(toInputDate(start));
    setRedactEndDate(toInputDate(end));
  }, []);

  useEffect(() => {
    if (!redactOpen) return;
    applyRedactPreset(DATE_RANGE_PRESETS[0]);
    setRedactError(null);
    setRedacting(false);
    setPreviewing(false);
    setRedactPreview(null);
    setAdvancedCategoriesOpen(false);
    setCategoryQuery("");
    void refreshRedactionPrefs();
  }, [redactOpen, applyRedactPreset, refreshRedactionPrefs]);

  async function runRedactionPass(dryRun: boolean) {
    if (
      redacting ||
      previewing ||
      !redactStartDate ||
      !redactEndDate ||
      redactStartDate > redactEndDate
    ) {
      return;
    }
    if (dryRun) {
      setPreviewing(true);
    } else {
      setRedacting(true);
    }
    setRedactError(null);
    try {
      // Let React paint the loader before the heavy IPC call starts.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (!dryRun) {
        await stopCaptureQuietly();
      }
      const result: RedactCaptureResult = await redactJarbasCapture({
        startDate: redactStartDate,
        endDate: redactEndDate,
        dryRun,
      });
      if (dryRun) {
        setRedactPreview(result);
      } else {
        setRedactOpen(false);
        setRedactPreview(null);
        setRedactNotice(result.message);
        await refreshStorage();
      }
    } catch (error) {
      setRedactError(error instanceof Error ? error.message : String(error));
    } finally {
      setRedacting(false);
      setPreviewing(false);
    }
  }

  const redactBusy = redacting || previewing;
  const redactRangeValid = Boolean(
    redactStartDate && redactEndDate && redactStartDate <= redactEndDate,
  );
  const enabledCategorySet = useMemo(
    () => new Set(enabledCategories),
    [enabledCategories],
  );
  const activeLadder = useMemo(
    () => matchRedactionLadder(enabledCategories),
    [enabledCategories],
  );
  const filteredCategoryGroups = useMemo(
    () => filterCategoryGroups(categoryQuery),
    [categoryQuery],
  );
  const previewCountRows = useMemo(
    () => redactionCountRows(redactPreview?.counts),
    [redactPreview],
  );

  const refreshPermissions = useCallback(async () => {
    const snapshot = await getCapturePermissionSnapshot();
    setAccessibilityInfo(snapshot.accessibilityInfo);
    setGranted({
      "screen-recording": snapshot.screen,
      accessibility: snapshot.accessibility,
    });
  }, []);

  useEffect(() => {
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
  }, [refreshPermissions]);

  useEffect(() => {
    void refreshStorage();
  }, [refreshStorage]);

  useEffect(() => {
    void refreshRedactionPrefs();
  }, [refreshRedactionPrefs]);

  useEffect(() => {
    void refreshCaptureFilters();
  }, [refreshCaptureFilters]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      try {
        const [info, llm] = await Promise.all([
          getPiAgentStatus(),
          getLlmSettings(),
        ]);
        if (!cancelled) {
          setPiInfo(info);
          setLlmSettings(llm);
        }
        unlisten = await listenPiAgentStatus((status) => {
          setPiInfo((current) =>
            current
              ? {
                  ...current,
                  status,
                  installed: status.kind === "ready" ? true : current.installed,
                }
              : current,
          );
        });
      } catch (error) {
        console.error("Failed to load settings", error);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  async function reinstallPi() {
    setBusy(true);
    try {
      const info = await ensurePiAgentInstalled(true);
      setPiInfo(info);
    } catch (error) {
      console.error("Failed to reinstall Pi agent", error);
    } finally {
      setBusy(false);
    }
  }

  async function saveKey(provider: LlmProvider, value: string) {
    setSavingProvider(provider);
    try {
      const next = await setLlmApiKey(provider, value);
      setLlmSettings(next);
    } catch (error) {
      console.error("Failed to save API key", error);
    } finally {
      setSavingProvider(null);
    }
  }

  async function removeKey(provider: LlmProvider) {
    setSavingProvider(provider);
    try {
      const next = await clearLlmApiKey(provider);
      setLlmSettings(next);
    } catch (error) {
      console.error("Failed to remove API key", error);
    } finally {
      setSavingProvider(null);
    }
  }

  async function handleReplayOnboarding() {
    if (replayingOnboarding) return;
    setReplayingOnboarding(true);
    setOnboardingError(null);
    try {
      await resetOnboarding();
    } catch (error) {
      setOnboardingError(
        error instanceof Error ? error.message : String(error),
      );
      setReplayingOnboarding(false);
    }
  }

  const installing = piInfo?.status.kind === "installing";
  const agentStatus = agentStatusCopy(piInfo?.status);

  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="label-caps text-muted-foreground">Jarbas</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        Settings
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        Theme, keys, Ask setup, privacy, onboarding, and local storage.
      </p>

      <section className="mt-10">
        <p className="label-caps text-primary">Appearance</p>
        <div className="mt-2 border border-border bg-card">
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Theme
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Light, dark, or system.
              </p>
            </div>
            <div className="shrink-0 pt-0.5">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <p className="label-caps text-primary">Ask</p>
        <div className="mt-2 border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Provider keys
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Kept on {thisComputerPhrase()}. Choose which one to use in Ask.
            </p>
          </div>
          <div className="divide-y divide-border">
            {(llmSettings?.keys ?? EMPTY_KEYS).map((item) => (
              <ApiKeyRow
                key={item.provider}
                item={item}
                busy={savingProvider === item.provider}
                onSave={(value) => saveKey(item.provider, value)}
                onRemove={() => removeKey(item.provider)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <p className="label-caps text-primary">Ask setup</p>
        <div className="mt-2 border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Local Ask engine
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Runs privately on {thisComputerPhrase()} so Ask can answer.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", agentStatus.tone)}>
                {agentStatus.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {agentStatus.detail}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-none"
              disabled={busy || installing}
              onClick={() => void reinstallPi()}
            >
              <RefreshCw className="size-3.5" />
              {installing || busy ? "Setting up…" : "Set up again"}
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <p className="label-caps text-primary">Onboarding</p>
        <div className="mt-2 border border-border bg-card">
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Setup walkthrough
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Replay welcome and permission setup. Your keys and local data
                stay put.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-none"
              disabled={replayingOnboarding}
              onClick={() => void handleReplayOnboarding()}
            >
              <RotateCcw className="size-3.5" />
              {replayingOnboarding ? "Starting…" : "Replay onboarding"}
            </Button>
          </div>
          {onboardingError ? (
            <p className="border-t border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {onboardingError}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <p className="label-caps text-primary">Trust</p>
        <div className="mt-2 border border-border bg-card">
          <button
            type="button"
            className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            onClick={() => onNavigate?.("privacy")}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Lock className="size-3.5 shrink-0 text-primary" />
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  How Jarbas uses data
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                What stays on this device, what can go to the cloud, and your
                privacy controls.
              </p>
            </div>
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </section>

      <section className="mt-8">
        <p className="label-caps text-primary">Permissions</p>
        <div className="mt-2 border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              System access
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {capturePermissionsBlurb()}
            </p>
            {permissionsError ? (
              <p className="mt-2 text-sm text-destructive">{permissionsError}</p>
            ) : null}
          </div>
          <ul className="divide-y divide-border">
            {permissions.map((permission) => {
              const isGranted = granted[permission.id];
              const showProcessHint =
                permission.id === "accessibility" &&
                permission.requiredOnHost &&
                !isGranted &&
                (accessibilityInfo?.processName ||
                  accessibilityInfo?.executablePath);
              async function openPermissionSettings() {
                setPermissionsError(null);
                if (
                  permission.id === "accessibility" &&
                  permission.requiredOnHost
                ) {
                  // Prompt in parallel; do not wait before deep-linking.
                  void getAccessibilityPermissionStatus({ prompt: true });
                }
                try {
                  await openPrivacySettings(permission.pane);
                } catch (error) {
                  console.error("Failed to open privacy settings", error);
                  setPermissionsError(
                    error instanceof Error
                      ? error.message
                      : "Could not open system settings.",
                  );
                }
                void refreshPermissions();
              }
              return (
                <li
                  key={permission.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {permission.label}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
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
                        . The packaged Jarbas app is a different entry from
                        this development build.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "label-caps inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px]",
                        isGranted || !permission.requiredOnHost
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {isGranted && permission.requiredOnHost ? (
                        <Check className="size-3" strokeWidth={2.5} />
                      ) : null}
                      {permission.requiredOnHost
                        ? isGranted
                          ? "Granted"
                          : "Required"
                        : "Ready"}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-none"
                      onClick={() => {
                        void openPermissionSettings();
                      }}
                    >
                      Open Settings
                      <ExternalLink className="size-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <p className="label-caps text-primary">Ignored apps</p>
        <div className="mt-2 border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Don&apos;t capture while focused
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Jarbas pauses capture while these apps are in focus.
            </p>
          </div>

          <div className="space-y-4 px-4 py-4">
            <div>
              <p className="label-caps text-muted-foreground">Desktop Apps</p>
              {ignoredWindows.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {ignoredWindows.map((item) => (
                    <li key={item}>
                      <AppBadge
                        name={item}
                        removeDisabled={filtersBusy}
                        onRemove={() => {
                          void removeIgnoredWindow(item);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              <form
                className="mt-2 flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addIgnoredWindow(ignoreDraft);
                }}
              >
                <div className="relative w-56">
                  {ignoreDraft.trim() ? (
                    <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2">
                      <AppLogoMark
                        name={ignoreDraft.trim()}
                        className="size-4"
                      />
                    </span>
                  ) : null}
                  <Input
                    value={ignoreDraft}
                    onChange={(event) => setIgnoreDraft(event.target.value)}
                    placeholder="App name"
                    disabled={filtersBusy}
                    className={cn(
                      "h-9 rounded-none",
                      ignoreDraft.trim() ? "pl-9" : undefined,
                    )}
                    aria-label="App or window to ignore"
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  disabled={filtersBusy || !ignoreDraft.trim()}
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </form>
            </div>

            <div className="border-t border-border pt-4">
              <p className="label-caps text-muted-foreground">URLs</p>
              {ignoredUrls.length > 0 ? (
                <ul className="mt-2 flex max-w-md flex-wrap gap-2">
                  {ignoredUrls.map((item) => (
                    <li
                      key={item}
                      className="inline-flex items-center gap-1 border border-border bg-background px-2 py-1 text-sm text-foreground"
                    >
                      <span className="max-w-[12rem] truncate">{item}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        disabled={filtersBusy}
                        aria-label={`Remove URL ${item}`}
                        onClick={() => {
                          void removeIgnoredUrl(item);
                        }}
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <form
                className="mt-2 flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addIgnoredUrl(ignoreUrlDraft);
                }}
              >
                <Input
                  value={ignoreUrlDraft}
                  onChange={(event) => setIgnoreUrlDraft(event.target.value)}
                  placeholder="chase.com"
                  disabled={filtersBusy}
                  className="h-9 w-56 rounded-none"
                  aria-label="URL domain to ignore"
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  disabled={filtersBusy || !ignoreUrlDraft.trim()}
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </form>
            </div>
          </div>

          {filtersNotice ? (
            <p className="border-t border-border px-4 py-3 text-sm text-foreground">
              {filtersNotice}
            </p>
          ) : null}
          {filtersError ? (
            <p className="border-t border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {filtersError}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <p className="label-caps text-primary">Redaction</p>
        <div className="mt-2 border border-border bg-card">
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Auto-redact
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Scrub with your selected severity tier when a recording ends.
              </p>
            </div>
            <Switch
              checked={autoRedactOnStop}
              disabled={autoRedactBusy}
              onCheckedChange={(checked) => {
                void onAutoRedactToggle(checked);
              }}
              aria-label="Auto-redact after End Recording"
              className="mt-1 shrink-0"
            />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              disabled={redactBusy}
              onClick={() => {
                setRedactError(null);
                setRedactNotice(null);
                setRedactOpen(true);
              }}
            >
              <Shield className="size-3.5" />
              Redact
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              onClick={() => onNavigate?.("redactions")}
            >
              <History className="size-3.5" />
              History
            </Button>
          </div>
          {redactNotice ? (
            <p className="border-t border-border px-4 py-3 text-sm text-foreground">
              {redactNotice}
            </p>
          ) : null}
          {redactError && !redactOpen ? (
            <p className="border-t border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {redactError}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <p className="label-caps text-primary">Storage</p>
        <div className="mt-2 border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Local data
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Saved on {thisComputerPhrase()} for Jarbas.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border">
            <div className="bg-card px-4 py-4">
              <p className="label-caps text-muted-foreground">Size</p>
              <p className="mt-1 font-display text-2xl tracking-tight text-foreground">
                {storage ? formatBytes(storage.bytes) : "-"}
              </p>
            </div>
            <div className="bg-card px-4 py-4">
              <p className="label-caps text-muted-foreground">Frames</p>
              <p className="mt-1 font-display text-2xl tracking-tight text-foreground">
                {storage ? formatFrameCount(storage.frames) : "-"}
              </p>
            </div>
          </div>

          <div className="border-t border-border px-4 py-4">
            <p className="text-sm text-muted-foreground">
              Delete a date range, or reset all local data.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none"
                onClick={() => {
                  setResetError(null);
                  setRangeOpen(true);
                }}
              >
                <Trash2 className="size-3.5" />
                Delete by range
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={() => {
                  setResetError(null);
                  setFullOpen(true);
                }}
              >
                <Trash2 className="size-3.5" />
                Reset all local data
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-none text-muted-foreground"
                onClick={() => void refreshStorage()}
              >
                <RefreshCw className="size-3.5" />
                Refresh
              </Button>
            </div>
            {resetNotice ? (
              <p className="mt-3 border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                {resetNotice}
              </p>
            ) : null}
            {resetError ? (
              <p className="mt-3 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {resetError}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <Dialog open={rangeOpen} onOpenChange={setRangeOpen}>
        <DialogContent className="rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete data by range</DialogTitle>
            <DialogDescription>
              Deletes recordings and analysis in this range. Keeps your keys and
              Ask setup.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {DATE_RANGE_PRESETS.filter((preset) =>
                ["last-7", "last-14", "last-30", "this-month", "today"].includes(
                  preset.id,
                ),
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(
                    "border px-2.5 py-1 text-xs transition-colors",
                    presetId === preset.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => {
                    const range = preset.getRange();
                    setPresetId(preset.id);
                    setStartDate(toInputDate(range.start));
                    setEndDate(toInputDate(range.end));
                  }}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                className={cn(
                  "border px-2.5 py-1 text-xs transition-colors",
                  presetId === "custom"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setPresetId("custom")}
              >
                Custom
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="label-caps text-muted-foreground">Start</p>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setPresetId("custom");
                    setStartDate(event.target.value);
                  }}
                  className="rounded-none"
                />
              </div>
              <div className="space-y-1.5">
                <p className="label-caps text-muted-foreground">End</p>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => {
                    setPresetId("custom");
                    setEndDate(event.target.value);
                  }}
                  className="rounded-none"
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Will delete: {formatRangeLabel(startDate, endDate)}
            </p>
            {resetError ? (
              <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {resetError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={resetting}
              onClick={() => setRangeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-none"
              disabled={
                resetting || !startDate || !endDate || startDate > endDate
              }
              onClick={() => void handleRangeDelete()}
            >
              {resetting ? "Deleting…" : "Delete range"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={redactOpen}
        onOpenChange={(open) => {
          if (redactBusy) return;
          setRedactOpen(open);
        }}
      >
        <DialogContent
          className="flex max-h-[min(94.5dvh,42rem)] flex-col gap-4 overflow-hidden rounded-none sm:max-w-xl"
          showCloseButton={!redactBusy}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {redacting
                ? "Redacting sensitive text"
                : previewing
                  ? "Previewing redaction"
                  : "Redact sensitive text"}
            </DialogTitle>
            <DialogDescription>
              {redacting
                ? "Scanning stored capture text for this range. The app is still working."
                : previewing
                  ? "Counting matches without changing your data."
                  : "Pick a range and categories, preview, then scrub. Frames stay. Can’t undo."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {redactBusy ? (
            <div className="border border-border bg-muted/40 px-3 py-3 text-sm text-foreground">
              <p className="font-medium">Working…</p>
              <p className="mt-0.5 text-muted-foreground">
                {previewing ? "Previewing" : "Scrubbing"}{" "}
                {formatRangeLabel(redactStartDate, redactEndDate)}.
                This can take a bit on large libraries.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="label-caps text-muted-foreground">Suggestions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DATE_RANGE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        applyRedactPreset(preset);
                        setRedactPreview(null);
                      }}
                      className={cn(
                        "border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        redactPresetId === preset.id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-foreground hover:bg-muted",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="label-caps text-muted-foreground">Custom range</p>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">Start</span>
                    <Input
                      type="date"
                      value={redactStartDate}
                      onChange={(event) => {
                        setRedactPresetId("custom");
                        setRedactStartDate(event.target.value);
                        setRedactPreview(null);
                      }}
                      className="rounded-none"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">End</span>
                    <Input
                      type="date"
                      value={redactEndDate}
                      onChange={(event) => {
                        setRedactPresetId("custom");
                        setRedactEndDate(event.target.value);
                        setRedactPreview(null);
                      }}
                      className="rounded-none"
                    />
                  </label>
                </div>
                {!redactRangeValid ? (
                  <p className="mt-2 text-xs text-destructive">
                    End date must be on or after start date.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Selected · {formatRangeLabel(redactStartDate, redactEndDate)}
                  </p>
                )}
              </div>

              <div>
                <p className="label-caps text-muted-foreground">Severity</p>
                <div className="mt-2 grid gap-2">
                  {REDACTION_LADDER_PRESETS.map((preset) => {
                    const selected = activeLadder === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={categoriesBusy}
                        onClick={() => applyLadder(preset.id)}
                        className={cn(
                          "border px-3 py-2.5 text-left transition-colors disabled:opacity-50",
                          selected
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-foreground hover:bg-muted",
                        )}
                      >
                        <p className="text-sm font-medium">{preset.label}</p>
                        <p
                          className={cn(
                            "mt-0.5 text-xs",
                            selected
                              ? "text-background/80"
                              : "text-muted-foreground",
                          )}
                        >
                          {preset.detail}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {activeLadder === "custom"
                    ? `Custom · ${enabledCategories.length} categories`
                    : `${enabledCategories.length} categories · also used for auto-redact`}
                </p>

                <button
                  type="button"
                  className="mt-3 text-xs font-medium text-primary hover:underline"
                  onClick={() =>
                    setAdvancedCategoriesOpen((current) => !current)
                  }
                >
                  {advancedCategoriesOpen
                    ? "Hide advanced categories"
                    : "Customize categories"}
                </button>

                {advancedCategoriesOpen ? (
                  <div className="mt-3 space-y-3">
                    <Input
                      value={categoryQuery}
                      onChange={(event) => setCategoryQuery(event.target.value)}
                      placeholder="Search categories"
                      className="rounded-none"
                    />
                    <div className="max-h-52 overflow-y-auto border border-border bg-background">
                      {filteredCategoryGroups.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">
                          No categories match.
                        </p>
                      ) : (
                        filteredCategoryGroups.map((group) => {
                          const enabledCount = group.options.filter((item) =>
                            enabledCategorySet.has(item.tag),
                          ).length;
                          const allOn = enabledCount === group.options.length;
                          return (
                            <div
                              key={group.id}
                              className="border-b border-border last:border-b-0"
                            >
                              <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-2">
                                <p className="text-xs font-medium text-foreground">
                                  {group.label}
                                  <span className="ml-1.5 text-muted-foreground">
                                    {enabledCount}/{group.options.length}
                                  </span>
                                </p>
                                <button
                                  type="button"
                                  className="text-xs font-medium text-primary hover:underline disabled:opacity-40"
                                  disabled={categoriesBusy}
                                  onClick={() =>
                                    toggleCategoryGroup(
                                      group.options.map((item) => item.tag),
                                      !allOn,
                                    )
                                  }
                                >
                                  {allOn ? "Clear" : "All"}
                                </button>
                              </div>
                              <ul className="divide-y divide-border">
                                {group.options.map((item) => {
                                  const checked = enabledCategorySet.has(
                                    item.tag,
                                  );
                                  return (
                                    <li key={item.tag}>
                                      <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50">
                                        <input
                                          type="checkbox"
                                          className="size-3.5 accent-primary"
                                          checked={checked}
                                          disabled={categoriesBusy}
                                          onChange={() =>
                                            toggleRedactionCategory(item.tag)
                                          }
                                        />
                                        <span className="min-w-0 flex-1 text-foreground">
                                          {item.label}
                                        </span>
                                      </label>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {redactPreview ? (
                <div className="border border-border bg-muted/30 px-3 py-3 text-sm">
                  <p className="font-medium text-foreground">
                    {redactPreview.message}
                  </p>
                  {previewCountRows.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      {previewCountRows.slice(0, 8).map((row) => (
                        <li
                          key={row.tag}
                          className="flex items-center justify-between gap-3"
                        >
                          <span>{row.label}</span>
                          <span className="tabular-nums text-foreground">
                            {row.count}
                          </span>
                        </li>
                      ))}
                      {previewCountRows.length > 8 ? (
                        <li className="text-xs">
                          +{previewCountRows.length - 8} more categories
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {redactError ? (
            <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {redactError}
            </p>
          ) : null}
          </div>

          <DialogFooter className="shrink-0 gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={redactBusy}
              onClick={() => setRedactOpen(false)}
            >
              Cancel
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                disabled={
                  redactBusy ||
                  !redactRangeValid ||
                  enabledCategories.length === 0
                }
                onClick={() => void runRedactionPass(true)}
              >
                {previewing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Previewing…
                  </>
                ) : (
                  <>
                    <Eye className="size-3.5" />
                    Preview
                  </>
                )}
              </Button>
              <Button
                type="button"
                className="rounded-none"
                disabled={
                  redactBusy ||
                  !redactRangeValid ||
                  enabledCategories.length === 0
                }
                onClick={() => void runRedactionPass(false)}
              >
                {redacting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Redacting…
                  </>
                ) : (
                  <>
                    <Shield className="size-3.5" />
                    Redact range
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fullOpen} onOpenChange={setFullOpen}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset all local data?</DialogTitle>
            <DialogDescription>
              This deletes all local Jarbas data on {thisComputerPhrase()} -
              recordings, analysis, Ask setup, and keys. You cannot undo this.
            </DialogDescription>
          </DialogHeader>
          {resetError ? (
            <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {resetError}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={resetting}
              onClick={() => setFullOpen(false)}
            >
              Keep
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-none"
              disabled={resetting}
              onClick={() => void handleFullReset()}
            >
              {resetting ? "Resetting…" : "Delete everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
