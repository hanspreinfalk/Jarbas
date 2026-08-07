import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProviderLogo } from "@/components/jarbas/provider-logo";
import { ThemeToggle } from "@/components/jarbas/theme-toggle";
import {
  clearLlmApiKey,
  getLlmSettings,
  setLlmApiKey,
  type KeyStatus,
  type LlmProvider,
  type LlmSettings,
} from "@/lib/llm-settings";
import {
  checkAccessibilityPermission,
  openPrivacySettings,
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
  getCaptureStorageStats,
  screenpipe,
  type CaptureStorageStats,
} from "@/lib/screenpipe";
import { cn } from "@/lib/utils";

type PermissionId = "screen-recording" | "accessibility";

const PERMISSIONS = [
  {
    id: "screen-recording" as const,
    label: "Screen Recording",
    description: "Capture what is on screen.",
    pane: "screen-recording",
  },
  {
    id: "accessibility" as const,
    label: "Accessibility",
    description: "Read UI elements and app context.",
    pane: "accessibility",
  },
];

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
        detail: "Ask can use the assistant on this Mac.",
        tone: "text-primary",
      };
    case "installing":
      return {
        label: "Setting up…",
        detail: status.message || "Installing the assistant.",
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
        detail: "Set up the assistant to use Ask.",
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
          placeholder="Paste API key"
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

export function SettingsPage() {
  const [piInfo, setPiInfo] = useState<PiAgentInfo | null>(null);
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const [storage, setStorage] = useState<CaptureStorageStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingProvider, setSavingProvider] = useState<LlmProvider | null>(null);
  const [granted, setGranted] = useState<Record<PermissionId, boolean>>({
    "screen-recording": false,
    accessibility: false,
  });

  const refreshPermissions = useCallback(async () => {
    const [screenOk, accessibilityOk] = await Promise.all([
      screenpipe
        .permissions({ timeoutMs: 7500 })
        .then((status) => Boolean(status.screen))
        .catch(() => false),
      checkAccessibilityPermission(),
    ]);

    setGranted({
      "screen-recording": screenOk,
      accessibility: accessibilityOk,
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
    let cancelled = false;
    void getCaptureStorageStats()
      .then((stats) => {
        if (!cancelled) setStorage(stats);
      })
      .catch(() => {
        if (!cancelled) {
          setStorage({ root: "~/.jarbas", bytes: 0, frames: 0 });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const installing = piInfo?.status.kind === "installing";
  const agentStatus = agentStatusCopy(piInfo?.status);

  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="label-caps text-muted-foreground">Jarbas</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        Settings
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        Theme, model keys, assistant, and local storage.
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
        <p className="label-caps text-primary">Ask models</p>
        <div className="mt-2 border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              API keys
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Kept on this Mac. Pick the model in Ask.
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
        <p className="label-caps text-primary">Ask</p>
        <div className="mt-2 border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Assistant
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Runs privately on this Mac to answer Ask.
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
        <p className="label-caps text-primary">Permissions</p>
        <div className="mt-2 border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              System access
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              macOS permissions for capture.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {PERMISSIONS.map((permission) => {
              const isGranted = granted[permission.id];
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
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "label-caps inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px]",
                        isGranted
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {isGranted ? (
                        <Check className="size-3" strokeWidth={2.5} />
                      ) : null}
                      {isGranted ? "Granted" : "Required"}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-none"
                      onClick={() => {
                        void openPrivacySettings(permission.pane).then(() => {
                          void refreshPermissions();
                        });
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
        <p className="label-caps text-primary">Storage</p>
        <div className="mt-2 border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Local data
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              App data root is ~/.jarbas on this machine.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border">
            <div className="bg-card px-4 py-4">
              <p className="label-caps text-muted-foreground">Size</p>
              <p className="mt-1 font-display text-2xl tracking-tight text-foreground">
                {storage ? formatBytes(storage.bytes) : "—"}
              </p>
            </div>
            <div className="bg-card px-4 py-4">
              <p className="label-caps text-muted-foreground">Frames</p>
              <p className="mt-1 font-display text-2xl tracking-tight text-foreground">
                {storage ? formatFrameCount(storage.frames) : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
